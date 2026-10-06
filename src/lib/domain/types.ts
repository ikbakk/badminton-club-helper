export type ParticipantStatus = 'READY' | 'PLAYING' | 'RESTING' | 'AWAY' | 'OUT' | 'LEFT';
export type Membership = 'MEMBER' | 'GUEST';
export type Player = {
	id: string;
	name: string;
	membership: Membership;
	rating: number;
	uncertainty: number;
};
export type Participant = Player & {
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
export type Team = [string, string];
