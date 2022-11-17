interface ChatMessage {
	timestamp: number;
	rolls: RollType[];
}

interface ValidCommandCodes {

};

type ValueOf<T> = T[keyof T];
type ArbitraryObject = {[key: string]: any};

interface Actor {
	system: ArbitraryObject;
}

interface Item {
	system: ArbitraryObject;
}

interface ChatMessage {
	roll: RollType;
}

interface RollSendData {
	gm_id?: string;
	rollString?: string;
	player_id?: string;
	timestamp?: number;
	log_id?: number;
	command:  ValueOf<ValidCommandCodes>;
	target: string;
	infraction ?: string;
	rollId ?: number;
	dice?: string;
	player_timestamp ?: number;
	diagnostics ?: any;
}

interface EvaluationOptions {
	_securityId: number,
}

interface RollTerm {
	results: {active: boolean, result: number} []
}

type RollType = SecureRoll<Roll>;

type SecureRoll<T> = T & {options: {
	_securityTS: number,
	_securityId: number
},
	security: {
		TS: number,
		log_id: number
	}
};

interface BasicRollPackage {
	roll: Roll;
	gm_timestamp: number;
	log_id: number;
}

interface LogObj {
	roll: RollType;
	player_id: string;
	timestamp:number;
	used:string | null;
	status: statusType;
}

interface AwaitedRoll {
	playerId: string;
	expr: string;
	timestamp: number;
	resolve: (conf: Promise<BasicRollPackage> | BasicRollPackage ) => void ;
	reject: (reason:any) => void ;
}
type statusType = "unused" |"no-report" |  "not found" | "roll_modified" | "roll_used_multiple_times" | "unused_rolls" |  "stale" | "verified" | "already_done" ;
