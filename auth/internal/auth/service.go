package auth

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"

	authv1 "github.com/pyroaktiv/soa-tourism/auth-service/gen/go/tourism/auth/v1"
	"github.com/pyroaktiv/soa-tourism/auth-service/internal/config"
)

type Service struct {
	authv1.UnimplementedAuthServiceServer

	cfg      config.Config
	users    *mongo.Collection
	sessions *mongo.Collection
}

type userDocument struct {
	ID           string   `bson:"_id"`
	Username     string   `bson:"username"`
	Email        string   `bson:"email"`
	PasswordHash []byte   `bson:"password_hash"`
	Roles        []string `bson:"roles"`
	Blocked      bool     `bson:"blocked"`
}

type sessionDocument struct {
	ID        string    `bson:"_id"` // jti
	UserID    string    `bson:"user_id"`
	ExpiresAt time.Time `bson:"expires_at"`
}

type tokenClaims struct {
	UserID   string   `json:"uid"`
	Username string   `json:"username"`
	Email    string   `json:"email"`
	Roles    []string `json:"roles"`
	Type     string   `json:"typ"`
	jwt.RegisteredClaims
}

func NewService(cfg config.Config, db *mongo.Database) *Service {
	users := db.Collection("users")
	sessions := db.Collection("refresh_sessions")

	// Ensure unique indexes on users.username and users.email.
	_, _ = users.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "username", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	})

	// TTL index: MongoDB will delete expired sessions automatically.
	_, _ = sessions.Indexes().CreateMany(context.Background(), []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "expires_at", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(0),
		},
		{
			Keys: bson.D{{Key: "user_id", Value: 1}},
		},
	})

	return &Service{
		cfg:      cfg,
		users:    users,
		sessions: sessions,
	}
}

func (s *Service) Register(ctx context.Context, req *authv1.RegisterRequest) (*authv1.AuthResponse, error) {
	username := strings.TrimSpace(req.GetUsername())
	email := strings.ToLower(strings.TrimSpace(req.GetEmail()))
	password := req.GetPassword()

	roles, err := validateAndNormalizeRoles(req.GetRoles())

	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	if username == "" || email == "" || password == "" {
		return nil, status.Error(codes.InvalidArgument, "username, email and password are required")
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to hash password")
	}

	doc := userDocument{
		ID:           uuid.NewString(),
		Username:     strings.ToLower(username),
		Email:        email,
		PasswordHash: passwordHash,
		Roles:        roles,
		Blocked:      false,
	}

	if _, err := s.users.InsertOne(ctx, doc); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return nil, status.Error(codes.AlreadyExists, "username or email already exists")
		}
		return nil, status.Error(codes.Internal, "failed to create user")
	}

	pair, err := s.issueTokenPair(ctx, &doc)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to issue tokens")
	}

	return &authv1.AuthResponse{User: toProtoUser(&doc), Tokens: pair}, nil
}

func (s *Service) Login(ctx context.Context, req *authv1.LoginRequest) (*authv1.AuthResponse, error) {
	identifier := strings.ToLower(strings.TrimSpace(req.GetIdentifier()))
	password := req.GetPassword()
	if identifier == "" || password == "" {
		return nil, status.Error(codes.InvalidArgument, "identifier and password are required")
	}

	filter := bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "username", Value: identifier}},
		bson.D{{Key: "email", Value: identifier}},
	}}}

	var doc userDocument
	if err := s.users.FindOne(ctx, filter).Decode(&doc); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, status.Error(codes.NotFound, "user not found")
		}
		return nil, status.Error(codes.Internal, "database error")
	}
	if doc.Blocked {
		return nil, status.Error(codes.PermissionDenied, "account is blocked")
	}
	if bcrypt.CompareHashAndPassword(doc.PasswordHash, []byte(password)) != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid credentials")
	}

	pair, err := s.issueTokenPair(ctx, &doc)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to issue tokens")
	}

	return &authv1.AuthResponse{User: toProtoUser(&doc), Tokens: pair}, nil
}

func (s *Service) Refresh(ctx context.Context, req *authv1.RefreshRequest) (*authv1.TokenPair, error) {
	claims, err := s.parseToken(req.GetRefreshToken(), "refresh")
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid refresh token")
	}
	var session sessionDocument
	if err := s.sessions.FindOneAndDelete(ctx, bson.D{{Key: "_id", Value: claims.ID}}).Decode(&session); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, status.Error(codes.Unauthenticated, "refresh token expired or revoked")
		}
		return nil, status.Error(codes.Internal, "database error")
	}

	if time.Now().After(session.ExpiresAt) {
		return nil, status.Error(codes.Unauthenticated, "refresh token expired or revoked")
	}
	var user userDocument
	if user.Blocked {
		return nil, status.Error(codes.PermissionDenied, "account is blocked")
	}
	if err := s.users.FindOne(ctx, bson.D{{Key: "_id", Value: session.UserID}}).Decode(&user); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, status.Error(codes.NotFound, "user not found")
		}
		return nil, status.Error(codes.Internal, "database error")
	}

	return s.issueTokenPair(ctx, &user)
}

func (s *Service) Validate(ctx context.Context, req *authv1.ValidateRequest) (*authv1.ValidateResponse, error) {
	claims, err := s.parseToken(req.GetAccessToken(), "access")
	if err != nil {
		return &authv1.ValidateResponse{Valid: false}, nil
	}

	var user userDocument
	if err := s.users.FindOne(ctx, bson.D{{Key: "_id", Value: claims.UserID}}).Decode(&user); err != nil {
		return &authv1.ValidateResponse{Valid: false}, nil
	}
	if user.Blocked {
		return &authv1.ValidateResponse{Valid: false}, nil
	}

	return &authv1.ValidateResponse{Valid: true, User: toProtoUser(&user)}, nil
}

func (s *Service) Logout(ctx context.Context, req *authv1.LogoutRequest) (*emptypb.Empty, error) {
	claims, err := s.parseToken(req.GetRefreshToken(), "refresh")
	if err == nil {
		_, _ = s.sessions.DeleteOne(ctx, bson.D{{Key: "_id", Value: claims.ID}})
	}
	return &emptypb.Empty{}, nil
}

func (s *Service) ListUsers(ctx context.Context, req *authv1.ListUsersRequest) (*authv1.ListUsersResponse, error) {
	// Extract and Validate Admin Token
	claims, err := s.authorizeAdmin(ctx)
	if err != nil {
		return nil, err
	}
	log.Printf("Admin %s listing all users", claims.Username)

	// Setup pagination defaults
	pageSize := int64(req.GetPageSize())
	if pageSize <= 0 {
		pageSize = 20
	}
	pageNumber := int64(req.GetPageNumber())
	if pageNumber < 1 {
		pageNumber = 1
	}
	skip := (pageNumber - 1) * pageSize

	opts := options.Find().SetSort(bson.D{{Key: "username", Value: 1}}).SetLimit(pageSize).SetSkip(skip)

	cursor, err := s.users.Find(ctx, bson.D{}, opts)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to query users")
	}
	defer cursor.Close(ctx)

	var users []*authv1.User
	for cursor.Next(ctx) {
		var doc userDocument
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		users = append(users, toProtoUser(&doc))
	}

	total, _ := s.users.CountDocuments(ctx, bson.D{})

	return &authv1.ListUsersResponse{
		Users:      users,
		TotalCount: total,
	}, nil
}

func (s *Service) SearchUsers(ctx context.Context, req *authv1.SearchUsersRequest) (*authv1.SearchUsersResponse, error) {
	if _, err := s.authorizeAdmin(ctx); err != nil {
		return nil, err
	}

	query := strings.ToLower(strings.TrimSpace(req.GetUsername()))
	if query == "" {
		return &authv1.SearchUsersResponse{}, nil
	}

	filter := bson.M{"username": bson.M{"$regex": query, "$options": "i"}}

	cursor, err := s.users.Find(ctx, filter, options.Find().SetLimit(10))
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to search users")
	}
	defer cursor.Close(ctx)

	var users []*authv1.User
	for cursor.Next(ctx) {
		var doc userDocument
		if err := cursor.Decode(&doc); err != nil {
			continue
		}
		users = append(users, toProtoUser(&doc))
	}

	return &authv1.SearchUsersResponse{Users: users}, nil
}

func (s *Service) BlockUser(ctx context.Context, req *authv1.BlockUserRequest) (*authv1.BlockUserResponse, error) {
	// 1. extract and validate token from context
	token := getTokenFromContext(ctx)
	if token == "" {
		return nil, status.Error(codes.Unauthenticated, "missing token")
	}
	claims, err := s.parseToken(token, "access")
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid token")
	}
	// 2. check if user has admin role
	if !containsRole(claims.Roles, "admin") {
		return nil, status.Error(codes.PermissionDenied, "admin role required")
	}
	// 3. find and update the target user
	filter := bson.D{{Key: "_id", Value: req.GetUserId()}}
	update := bson.D{{Key: "$set", Value: bson.D{{Key: "blocked", Value: true}}}}
	result, err := s.users.UpdateOne(ctx, filter, update)
	if err != nil {
		return nil, status.Error(codes.Internal, "database error")
	}
	if result.MatchedCount == 0 {
		return nil, status.Error(codes.NotFound, "user not found")
	}

	return &authv1.BlockUserResponse{Success: true}, nil
}

func (s *Service) issueTokenPair(ctx context.Context, user *userDocument) (*authv1.TokenPair, error) {
	now := time.Now()
	accessExpiresAt := now.Add(s.cfg.AccessTokenTTL)
	refreshExpiresAt := now.Add(s.cfg.RefreshTokenTTL)
	refreshID := uuid.NewString()

	accessToken, err := s.signToken(user, "access", "", accessExpiresAt)
	if err != nil {
		return nil, err
	}
	refreshToken, err := s.signToken(user, "refresh", refreshID, refreshExpiresAt)
	if err != nil {
		return nil, err
	}

	session := sessionDocument{
		ID:        refreshID,
		UserID:    user.ID,
		ExpiresAt: refreshExpiresAt,
	}
	if _, err := s.sessions.InsertOne(ctx, session); err != nil {
		return nil, fmt.Errorf("store refresh session: %w", err)
	}

	return &authv1.TokenPair{
		AccessToken:           accessToken,
		AccessTokenExpiresAt:  accessExpiresAt.Unix(),
		RefreshToken:          refreshToken,
		RefreshTokenExpiresAt: refreshExpiresAt.Unix(),
	}, nil
}

func (s *Service) signToken(user *userDocument, tokenType, tokenID string, expiresAt time.Time) (string, error) {
	claims := tokenClaims{
		UserID:   user.ID,
		Username: user.Username,
		Email:    user.Email,
		Roles:    user.Roles,
		Type:     tokenType,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ID:        tokenID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}

func (s *Service) parseToken(rawToken, expectedType string) (*tokenClaims, error) {
	if rawToken == "" {
		return nil, errors.New("missing token")
	}

	token, err := jwt.ParseWithClaims(rawToken, &tokenClaims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*tokenClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	if claims.Type != expectedType {
		return nil, errors.New("unexpected token type")
	}
	return claims, nil
}

func (s *Service) authorizeAdmin(ctx context.Context) (*tokenClaims, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "missing metadata")
	}

	values := md.Get("authorization")
	if len(values) == 0 {
		return nil, status.Error(codes.Unauthenticated, "missing authorization header")
	}

	parts := strings.SplitN(values[0], " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return nil, status.Error(codes.Unauthenticated, "invalid authorization format")
	}

	claims, err := s.parseToken(parts[1], "access")
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid token")
	}

	isAdmin := false
	for _, role := range claims.Roles {
		if role == "admin" {
			isAdmin = true
			break
		}
	}

	if !isAdmin {
		return nil, status.Error(codes.PermissionDenied, "admin role required")
	}

	return claims, nil
}

func getTokenFromContext(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	tokens := md.Get("authorization")
	if len(tokens) == 0 {
		return ""
	}
	parts := strings.SplitN(tokens[0], " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}

func containsRole(roles []string, role string) bool {
	for _, r := range roles {
		if r == role {
			return true
		}
	}
	return false
}

func toProtoUser(user *userDocument) *authv1.User {
	return &authv1.User{
		Id:       user.ID,
		Username: user.Username,
		Email:    user.Email,
		Roles:    append([]string(nil), user.Roles...),
		Blocked:  user.Blocked,
	}
}

func validateAndNormalizeRoles(inputRoles []string) ([]string, error) {
	if len(inputRoles) == 0 {
		return []string{"tourist"}, nil
	}

	seen := make(map[string]struct{})
	var result []string

	for _, r := range inputRoles {
		normalized := strings.ToLower(strings.TrimSpace(r))

		if normalized == "" {
			continue
		}

		if normalized != "tourist" && normalized != "author" {
			return nil, fmt.Errorf("invalid role: %s (only 'tourist' or 'author' are allowed via registration)", normalized)
		}

		if _, ok := seen[normalized]; !ok {
			seen[normalized] = struct{}{}
			result = append(result, normalized)
		}
	}

	if len(result) == 0 {
		return []string{"tourist"}, nil
	}

	return result, nil
}
