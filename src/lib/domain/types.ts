export type ParticipantStatus = 'READY' | 'PLAYING' | 'RESTING' | 'AWAY' | 'OUT' | 'LEFT';
export type Membership = 'MEMBER' | 'GUEST';
export type Participant = {
	id: string;
	name: string;
	membership: Membership;
	rating: number;
	uncertainty: number;
	sessionParticipantId?: string;
	status: ParticipantStatus;
	readySince?: Date;
	consecutiveMatches: number;
	opportunities: number;
	missedOpportunities: number;
	currentOpportunityDebt: number;
	rotationsPlayed: number;
	setsPlayed: number;
	leaveAfterMatch?: boolean;
};
