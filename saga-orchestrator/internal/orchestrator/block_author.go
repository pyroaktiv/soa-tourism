package orchestrator

import (
	"log"

	"github.com/nats-io/nats.go"
	sagav1 "github.com/pyroaktiv/soa-tourism/saga-orchestrator/gen/go/tourism/saga/v1"
	"google.golang.org/protobuf/proto"
)

const (
	SubjectAuthBlockStarted     = "saga.block_author.auth.started"
	SubjectTourArchiveCommand   = "saga.block_author.tour.archive_command"
	SubjectTourArchiveResult    = "saga.block_author.tour.archive_result"
	SubjectPaymentRemoveCommand = "saga.block_author.payment.remove_command"
	SubjectPaymentRemoveResult  = "saga.block_author.payment.remove_result"
	SubjectAuthFinalizeCommand  = "saga.block_author.auth.finalize_command"
	SubjectTourFinalizeCommand  = "saga.block_author.tour.finalize_command"
)

type BlockAuthorOrchestrator struct {
	nc *nats.Conn
}

func NewBlockAuthorOrchestrator(nc *nats.Conn) *BlockAuthorOrchestrator {
	return &BlockAuthorOrchestrator{nc: nc}
}

func (o *BlockAuthorOrchestrator) Start() error {
	_, err := o.nc.Subscribe(SubjectAuthBlockStarted, o.handleStartEvent)
	if err != nil {
		return err
	}

	_, err = o.nc.Subscribe(SubjectTourArchiveResult, o.handleTourArchiveResult)
	if err != nil {
		return err
	}

	_, err = o.nc.Subscribe(SubjectPaymentRemoveResult, o.handlePaymentRemoveResult)
	if err != nil {
		return err
	}

	return nil
}

func (o *BlockAuthorOrchestrator) handleStartEvent(msg *nats.Msg) {
	var event sagav1.StartBlockAuthorEvent
	if err := proto.Unmarshal(msg.Data, &event); err != nil {
		log.Printf("Error unmarshalling start event: %v", err)
		return
	}

	log.Printf("SAGA START: Blocking user %s. Triggering tour archive.", event.UserId)

	command := &sagav1.ArchiveToursCommand{
		UserId: event.UserId,
	}
	o.publish(SubjectTourArchiveCommand, command)
}

func (o *BlockAuthorOrchestrator) handleTourArchiveResult(msg *nats.Msg) {
	var result sagav1.ArchiveToursResultEvent
	if err := proto.Unmarshal(msg.Data, &result); err != nil {
		log.Printf("Error unmarshalling tour archive result: %v", err)
		return
	}

	if !result.Success {
		log.Printf("SAGA ROLLBACK (Tour Fail): User %s. Rollback Auth.", result.UserId)
		o.finalizeSaga(result.UserId, sagav1.SagaStatus_SAGA_STATUS_ROLLBACK, true, false)
		return
	}

	log.Printf("SAGA STEP 2 (Tour Success): User %s. Triggering payment cart eviction for %d tours.", result.UserId, len(result.TourIds))
	command := &sagav1.RemoveToursFromCartCommand{
		UserId:  result.UserId,
		TourIds: result.TourIds,
	}
	o.publish(SubjectPaymentRemoveCommand, command)
}

func (o *BlockAuthorOrchestrator) handlePaymentRemoveResult(msg *nats.Msg) {
	var result sagav1.RemoveToursFromCartResultEvent
	if err := proto.Unmarshal(msg.Data, &result); err != nil {
		log.Printf("Error unmarshalling payment result: %v", err)
		return
	}

	if !result.Success {
		log.Printf("SAGA ROLLBACK (Payment Fail): User %s. Rollback Auth and Tour.", result.UserId)
		o.finalizeSaga(result.UserId, sagav1.SagaStatus_SAGA_STATUS_ROLLBACK, true, true)
		return
	}

	log.Printf("SAGA SUCCESS: User %s. Confirming changes in Auth and Tour.", result.UserId)
	o.finalizeSaga(result.UserId, sagav1.SagaStatus_SAGA_STATUS_SUCCESS, true, true)
}

func (o *BlockAuthorOrchestrator) finalizeSaga(userID string, status sagav1.SagaStatus, notifyAuth bool, notifyTour bool) {
	command := &sagav1.FinalizeBlockAuthorCommand{
		UserId: userID,
		Status: status,
	}

	if notifyAuth {
		o.publish(SubjectAuthFinalizeCommand, command)
	}
	if notifyTour {
		o.publish(SubjectTourFinalizeCommand, command)
	}
}

func (o *BlockAuthorOrchestrator) publish(subject string, message proto.Message) {
	data, err := proto.Marshal(message)
	if err != nil {
		log.Printf("Error marshalling message for subject %s: %v", subject, err)
		return
	}

	if err := o.nc.Publish(subject, data); err != nil {
		log.Printf("Error publishing to subject %s: %v", subject, err)
	}
}
