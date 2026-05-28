package clients

import (
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/nats-io/nats.go"
	authv1 "github.com/pyroaktiv/soa-tourism/payment-service/gen/go/tourism/auth/v1"
	tourv1 "github.com/pyroaktiv/soa-tourism/payment-service/gen/go/tourism/tour/v1"
)

type Clients struct {
	Auth     authv1.AuthServiceClient
	Tour     tourv1.TourServiceClient
	NatsConn *nats.Conn

	authConn *grpc.ClientConn
	tourConn *grpc.ClientConn
}

func Dial(authAddr, tourAddr string, natsURL string) (*Clients, error) {
	authConn, err := grpc.NewClient(authAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial auth: %w", err)
	}

	tourConn, err := grpc.NewClient(tourAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		authConn.Close()
		return nil, fmt.Errorf("dial tour: %w", err)
	}

	nc, err := nats.Connect(natsURL)
	if err != nil {
		authConn.Close()
		tourConn.Close()
		return nil, fmt.Errorf("connect nats: %w", err)
	}

	return &Clients{
		Auth:     authv1.NewAuthServiceClient(authConn),
		Tour:     tourv1.NewTourServiceClient(tourConn),
		NatsConn: nc,
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
	if c.NatsConn != nil {
		c.NatsConn.Close()
	}
}
