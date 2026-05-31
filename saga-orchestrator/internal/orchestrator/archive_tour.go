package orchestrator

import (
	"log"

	"github.com/nats-io/nats.go"
	sagav1 "github.com/pyroaktiv/soa-tourism/saga-orchestrator/gen/go/tourism/saga/v1"
	"google.golang.org/protobuf/proto"
)

const (
	// Definicija NATS subjekata za drugu sagu
	SubjectTourArchiveStarted       = "saga.archive_tour.tour.started"
	SubjectPaymentEvictSingleCmd    = "saga.archive_tour.payment.evict_command"
	SubjectPaymentEvictSingleResult = "saga.archive_tour.payment.evict_result"
	SubjectTourFinalizeSingleCmd    = "saga.archive_tour.tour.finalize_command"
)

type ArchiveTourOrchestrator struct {
	nc *nats.Conn
}

func NewArchiveTourOrchestrator(nc *nats.Conn) *ArchiveTourOrchestrator {
	return &ArchiveTourOrchestrator{nc: nc}
}

func (o *ArchiveTourOrchestrator) Start() error {
	// 1. Slušaj kada Tour servis započne arhiviranje jedne ture
	_, err := o.nc.Subscribe(SubjectTourArchiveStarted, o.handleStartEvent)
	if err != nil {
		return err
	}

	// 2. Slušaj odgovor od Payment servisa
	_, err = o.nc.Subscribe(SubjectPaymentEvictSingleResult, o.handlePaymentEvictResult)
	if err != nil {
		return err
	}

	return nil
}

// Korak 1: Tour je javio da je stavio turu u PENDING -> Šaljemo Paymentu komandu
func (o *ArchiveTourOrchestrator) handleStartEvent(msg *nats.Msg) {
	var event sagav1.StartArchiveTourEvent
	if err := proto.Unmarshal(msg.Data, &event); err != nil {
		log.Printf("[Archive Tour Saga] Error unmarshalling start event: %v", err)
		return
	}

	log.Printf("[Archive Tour Saga] START: Tour %s. Triggering cart eviction.", event.TourId)

	command := &sagav1.EvictSingleTourFromCartCommand{
		TourId: event.TourId,
	}
	o.publish(SubjectPaymentEvictSingleCmd, command)
}

// Korak 2: Payment servis odgovara
func (o *ArchiveTourOrchestrator) handlePaymentEvictResult(msg *nats.Msg) {
	var result sagav1.EvictSingleTourFromCartResultEvent
	if err := proto.Unmarshal(msg.Data, &result); err != nil {
		log.Printf("[Archive Tour Saga] Error unmarshalling payment result: %v", err)
		return
	}

	if !result.Success {
		// Payment fail -> Rollback u Tour servisu
		log.Printf("[Archive Tour Saga] ROLLBACK: Tour %s. Payment failed: %s", result.TourId, result.ErrorMessage)
		o.finalizeSaga(result.TourId, sagav1.SagaStatus_SAGA_STATUS_ROLLBACK)
		return
	}

	// Payment success -> Commit u Tour servisu
	log.Printf("[Archive Tour Saga] SUCCESS: Tour %s. Confirming archive in Tour service.", result.TourId)
	o.finalizeSaga(result.TourId, sagav1.SagaStatus_SAGA_STATUS_SUCCESS)
}

func (o *ArchiveTourOrchestrator) finalizeSaga(tourID string, status sagav1.SagaStatus) {
	command := &sagav1.FinalizeArchiveTourCommand{
		TourId: tourID,
		Status: status,
	}
	o.publish(SubjectTourFinalizeSingleCmd, command)
}

func (o *ArchiveTourOrchestrator) publish(subject string, message proto.Message) {
	data, err := proto.Marshal(message)
	if err != nil {
		log.Printf("[Archive Tour Saga] Error marshalling message for %s: %v", subject, err)
		return
	}
	if err := o.nc.Publish(subject, data); err != nil {
		log.Printf("[Archive Tour Saga] Error publishing to %s: %v", subject, err)
	}
}
