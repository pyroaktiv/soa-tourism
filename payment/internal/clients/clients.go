package clients

import (
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	authv1 "github.com/pyroaktiv/soa-tourism/payment-service/gen/go/tourism/auth/v1"
	tourv1 "github.com/pyroaktiv/soa-tourism/payment-service/gen/go/tourism/tour/v1"
)

type Clients struct {
	Auth authv1.AuthServiceClient
	Tour tourv1.TourServiceClient

	authConn *grpc.ClientConn
	tourConn *grpc.ClientConn
}

func Dial(authAddr, tourAddr string) (*Clients, error) {
	authConn, err := grpc.NewClient(authAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial auth: %w", err)
	}

	tourConn, err := grpc.NewClient(tourAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		authConn.Close()
		return nil, fmt.Errorf("dial tour: %w", err)
	}

	return &Clients{
		Auth:     authv1.NewAuthServiceClient(authConn),
		Tour:     tourv1.NewTourServiceClient(tourConn),
		authConn: authConn,
		tourConn: tourConn,
	}, nil
}

func (c *Clients) Close() {
	if c.authConn != nil {
		c.authConn.Close()
	}
	if c.tourConn != nil {
		c.tourConn.Close()
	}
}
