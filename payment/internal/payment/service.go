package payment

import (
	"context"
	"errors"
	"log"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	authv1 "github.com/pyroaktiv/soa-tourism/payment-service/gen/go/tourism/auth/v1"
	paymentv1 "github.com/pyroaktiv/soa-tourism/payment-service/gen/go/tourism/payment/v1"
	tourv1 "github.com/pyroaktiv/soa-tourism/payment-service/gen/go/tourism/tour/v1"
	"github.com/pyroaktiv/soa-tourism/payment-service/internal/clients"
	"github.com/pyroaktiv/soa-tourism/payment-service/internal/repository"
)

type Service struct {
	paymentv1.UnimplementedPaymentServiceServer

	repo    *repository.Repository
	clients *clients.Clients
}

func NewService(repo *repository.Repository, c *clients.Clients) *Service {
	return &Service{repo: repo, clients: c}
}

func (s *Service) GetCart(ctx context.Context, _ *paymentv1.GetCartRequest) (*paymentv1.ShoppingCart, error) {
	user, err := s.requireTourist(ctx)
	if err != nil {
		return nil, err
	}

	cart, err := s.repo.GetOrCreateCart(ctx, user.GetId())
	if err != nil {
		log.Printf("get cart: %v", err)
		return nil, status.Error(codes.Internal, "failed to load cart")
	}
	return toProtoCart(cart), nil
}

func (s *Service) AddToCart(ctx context.Context, req *paymentv1.AddToCartRequest) (*paymentv1.ShoppingCart, error) {
	user, err := s.requireTourist(ctx)
	if err != nil {
		return nil, err
	}

	tourID := strings.TrimSpace(req.GetTourId())
	if tourID == "" {
		return nil, status.Error(codes.InvalidArgument, "tour_id is required")
	}

	// Fetch tour info from tour service so price and name are authoritative.
	// The bearer token is forwarded so the tour service can authorize the call.
	tourCtx := forwardAuth(ctx)
	tour, err := s.clients.Tour.GetTour(tourCtx, &tourv1.GetTourRequest{Id: tourID})
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "tour not found: %v", err)
	}
	if tour.GetStatus() != tourv1.TourStatus_TOUR_STATUS_PUBLISHED {
		return nil, status.Error(codes.FailedPrecondition, "only published tours can be added to cart")
	}

	cart, err := s.repo.AddItem(ctx, user.GetId(), tour.GetId(), tour.GetName(), tour.GetPrice())
	if err != nil {
		if errors.Is(err, repository.ErrAlreadyExists) {
			return nil, status.Error(codes.AlreadyExists, "tour already purchased")
		}
		log.Printf("add to cart: %v", err)
		return nil, status.Error(codes.Internal, "failed to add to cart")
	}
	return toProtoCart(cart), nil
}

func (s *Service) RemoveFromCart(ctx context.Context, req *paymentv1.RemoveFromCartRequest) (*paymentv1.ShoppingCart, error) {
	user, err := s.requireTourist(ctx)
	if err != nil {
		return nil, err
	}
	tourID := strings.TrimSpace(req.GetTourId())
	if tourID == "" {
		return nil, status.Error(codes.InvalidArgument, "tour_id is required")
	}

	cart, err := s.repo.RemoveItem(ctx, user.GetId(), tourID)
	if err != nil {
		log.Printf("remove from cart: %v", err)
		return nil, status.Error(codes.Internal, "failed to remove from cart")
	}
	return toProtoCart(cart), nil
}

func (s *Service) Checkout(ctx context.Context, _ *paymentv1.CheckoutRequest) (*paymentv1.CheckoutResponse, error) {
	user, err := s.requireTourist(ctx)
	if err != nil {
		return nil, err
	}

	tokens, err := s.repo.Checkout(ctx, user.GetId())
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, status.Error(codes.FailedPrecondition, "cart is empty")
		}
		log.Printf("checkout: %v", err)
		return nil, status.Error(codes.Internal, "checkout failed")
	}

	out := make([]*paymentv1.TourPurchaseToken, 0, len(tokens))
	for i := range tokens {
		out = append(out, toProtoToken(&tokens[i]))
	}
	return &paymentv1.CheckoutResponse{Tokens: out}, nil
}

func (s *Service) ListMyTokens(ctx context.Context, _ *paymentv1.ListMyTokensRequest) (*paymentv1.ListMyTokensResponse, error) {
	user, err := s.requireTourist(ctx)
	if err != nil {
		return nil, err
	}

	tokens, err := s.repo.ListTokens(ctx, user.GetId())
	if err != nil {
		log.Printf("list tokens: %v", err)
		return nil, status.Error(codes.Internal, "failed to list purchases")
	}
	out := make([]*paymentv1.TourPurchaseToken, 0, len(tokens))
	for i := range tokens {
		out = append(out, toProtoToken(&tokens[i]))
	}
	return &paymentv1.ListMyTokensResponse{Tokens: out}, nil
}

func (s *Service) HasToken(ctx context.Context, req *paymentv1.HasTokenRequest) (*paymentv1.HasTokenResponse, error) {
	user, err := s.requireAuth(ctx)
	if err != nil {
		return nil, err
	}
	tourID := strings.TrimSpace(req.GetTourId())
	if tourID == "" {
		return nil, status.Error(codes.InvalidArgument, "tour_id is required")
	}
	has, err := s.repo.HasToken(ctx, user.GetId(), tourID)
	if err != nil {
		log.Printf("has token: %v", err)
		return nil, status.Error(codes.Internal, "failed to query purchases")
	}
	return &paymentv1.HasTokenResponse{HasToken: has}, nil
}

// requireAuth validates the bearer token via auth-service and returns the user.
func (s *Service) requireAuth(ctx context.Context) (*authv1.User, error) {
	token := bearerFromCtx(ctx)
	if token == "" {
		return nil, status.Error(codes.Unauthenticated, "missing bearer token")
	}
	resp, err := s.clients.Auth.Validate(ctx, &authv1.ValidateRequest{AccessToken: token})
	if err != nil {
		log.Printf("auth validate: %v", err)
		return nil, status.Error(codes.Unauthenticated, "auth service unavailable")
	}
	if !resp.GetValid() || resp.GetUser() == nil {
		return nil, status.Error(codes.Unauthenticated, "invalid token")
	}
	return resp.GetUser(), nil
}

// requireTourist ensures the caller is authenticated AND has the "tourist" role.
// Cart/checkout endpoints are tourist-only.
func (s *Service) requireTourist(ctx context.Context) (*authv1.User, error) {
	user, err := s.requireAuth(ctx)
	if err != nil {
		return nil, err
	}
	for _, role := range user.GetRoles() {
		if role == "tourist" {
			return user, nil
		}
	}
	return nil, status.Error(codes.PermissionDenied, "tourist role required")
}

func bearerFromCtx(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	values := md.Get("authorization")
	if len(values) == 0 {
		return ""
	}
	parts := strings.SplitN(values[0], " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}

// forwardAuth copies the inbound authorization metadata to the outgoing context
// so downstream gRPC services see the same caller identity.
func forwardAuth(ctx context.Context) context.Context {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ctx
	}
	return metadata.NewOutgoingContext(ctx, md.Copy())
}

func toProtoCart(c *repository.Cart) *paymentv1.ShoppingCart {
	items := make([]*paymentv1.OrderItem, 0, len(c.Items))
	var total float64
	for _, it := range c.Items {
		items = append(items, &paymentv1.OrderItem{
			Id:       it.ID,
			TourId:   it.TourID,
			TourName: it.TourName,
			Price:    it.Price,
			AddedAt:  it.AddedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		})
		total += it.Price
	}
	return &paymentv1.ShoppingCart{
		Id:         c.ID,
		UserId:     c.UserID,
		Items:      items,
		TotalPrice: total,
	}
}

func toProtoToken(t *repository.PurchaseToken) *paymentv1.TourPurchaseToken {
	return &paymentv1.TourPurchaseToken{
		Id:          t.ID,
		UserId:      t.UserID,
		TourId:      t.TourID,
		TourName:    t.TourName,
		Price:       t.Price,
		PurchasedAt: t.PurchasedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}
