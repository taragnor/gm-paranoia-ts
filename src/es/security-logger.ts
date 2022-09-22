type statusType = "unused" |"no-report" |  "not found" | "roll_modified" | "roll_used_multiple_times" | "unused_rolls" |  "stale" | "verified" | "already_done" ;


import {Debug} from "./debug.js";
import {TaragnorSecurity, getGame} from "./main.js";

declare global {
	interface EvaluationOptions {
		_securityId: number,
	}
	interface RollTerm {
		results: {active: boolean, result: number} []

	}
	type RollType = SecureRoll<Roll>;
}

type SecureRoll<T> = T & {options: {
	_securityTS: number,
	_securityId: number
}
security: {
	TS: number,
	log_id: number
}
};

interface LogObj {
	roll: RollType;
	player_id: string;
	timestamp:number;
	used:string | null;
	status: statusType;
}

interface BasicRollPackage {
	roll: Roll;
	gm_timestamp: number;
	log_id: number;
}

interface AwaitedRoll {
	playerId: string;
	expr: string;
	timestamp: number;
	resolve: (conf: Promise<BasicRollPackage> | BasicRollPackage ) => void ;
	reject: (reason:any) => void ;


}

export class SecurityLogger {
	static staleCounter = 70000;
	static recentCounter = 8000000;
	players: string[];
	logs: LogObj[];
	startScan: boolean;
	reported: boolean;
	awaitedRolls: AwaitedRoll[];
	startTime: number;
	logPath : string;
	logFileEnabled: boolean;

	constructor (logPath: string) {
		this.startTime = Date.now();
		this.players = [];
		this.logs = [];
		this.startScan = false;
		this.reported= false;
		this.awaitedRolls = [];
		if (!logPath) {
			this.logFileEnabled = false;
			return;
		}
		this.logPath = logPath;
		this.logFileEnabled = true;
		this.loadFile(logPath)
		//TODO: Setup log file logic
	}

	async loadFile(_logPath :string) {

	}

	async playerSignIn(player_id: string) {
		this.players.push(player_id);
	}

	async logRoll(roll: RollType, player_id:string, gm_timestamp: number) {
		const logObj : LogObj = {
			roll,
			player_id,
			timestamp:gm_timestamp,
			used: null,
			status: "unused"
		};
		this.logs.push(logObj );
		if (!this.logFileEnabled) return;
		//TODO: actually make a persistent log file
	}

	getNextId() {
		return this.logs.length;
	}

	checkBasicFind(roll : RollType) : LogObj | null  {
		try {
			const index = roll.options["_securityId"];
			if (index == undefined)
				throw new Error("Index Not defined on roll");
			const log = this.logs[index];
			if (log.timestamp == roll.options["_securityTS"])
				return log;
		} catch (e) {
			Debug(roll);
			console.warn(e);
		}
		return null;
	}

	static checkStaleRoll(roll: RollType, timestamp: number) : boolean {
		try {
			const span = timestamp - roll.options["_securityTS"];
			if (Number.isNaN(span))
				throw new Error("NaN value");
			const stale  = span > SecurityLogger.staleCounter;
			if (stale)
				console.log(`Stale roll count: ${span}`);
			return stale;
		}catch (e) {
			console.error(e);
		}
		return false;
	}

	verifyRolls( rolls: RollType[], timestamp: number, player_id: string, chatlog_id: string) : statusType {
		const statusNum = rolls
			.map( r => this.verifyRoll(r, timestamp, player_id, chatlog_id))
			.map ( st=> SecurityLogger.numberizeStatus(st))
			.reduce( (acc, status) => Math.min(acc, status), 10)
		return SecurityLogger.unnumberizeStatus(statusNum);
	}

	static numberizeStatus(status:statusType) : number {
		switch (status) {
			case "no-report":
				return 0;
			case "roll_modified":
				return 1;
			case "not found":
				return 2;
			case "roll_used_multiple_times":
				return 3
			case "unused_rolls":
				return 4
			case "stale":
				return 5;
			case "unused":
				return 6;
			case "already_done":
				return 9;
			case "verified":
				return 10;
		}
	}

	static unnumberizeStatus(stnum : number) : statusType {
		switch (stnum) {
			case 0: return "no-report";
			case 1: return "roll_modified";
			case 2: return "not found";
			case 3: return "roll_used_multiple_times";
			case 4: return "unused_rolls";
			case 5: return "stale";
			case 6: return "unused";
			case 9: return "already_done";
			case 10: return "verified";
			default: throw new Error(`bad number passed: ${stnum}`);
		}

	}

	verifyRoll(roll: RollType, timestamp: number, player_id: string, chatlog_id: string) : statusType  {
		const exists = this.checkBasicFind(roll);
		const recentLogs = this.logs.filter( x=>
			x.player_id == player_id
			&& timestamp - x.timestamp < SecurityLogger.recentCounter
			&& timestamp != x.timestamp
		);
		if (!this.players.find( x=> x == player_id))
			return "no-report";
		if (!exists)
			return "not found";
		if (!SecurityLogger.rollsIdentical(exists.roll, roll)){
			exists.status = "roll_modified";
			exists.used = chatlog_id;
			return exists.status;
		}
		if (exists.used == chatlog_id)
			return exists.status;
		if (exists.used)  {
			exists.status = "roll_used_multiple_times";
			exists.used = chatlog_id;
			return exists.status;
		}
		if (recentLogs.filter( x=> !x.used).length > 1) {
			exists.status = "unused_rolls";
			exists.used = chatlog_id;
			return exists.status;
		}
		if (SecurityLogger.checkStaleRoll(exists.roll, timestamp)) {
			exists.status = "stale";
			exists.used = chatlog_id;
			return exists.status;
		}
		exists.used = chatlog_id;
		exists.status = "verified";
		return exists.status;
	}

	static rollsIdentical(rollA: RollType, rollB: RollType) {
		try {
			if (rollA.total != rollB.total)
				return false;
			return rollA.terms.every( (term: RollTerm, i) => {
				if (!("results" in term))
					return true;
				// if (!term?.results) return true;
				return term.results.every( (result: {result: number, active: boolean}, j: number) => {
					return result.result == rollB.terms[i].results[j].result;
				})
			});
		} catch (e) {
			console.error(e);
			return false;
		}
	}

	getRecentRolls(player_id: string, timestamp: number) {
		return this.logs.filter( x=> x.player_id == player_id &&
			timestamp - x.timestamp < 50000
		);
	}

	getTimeStamp() {
		return Date.now();
	}

	async viewLog() {
		const game = getGame();
		const logs =[...this.logs]
			.sort( (a,b) => {
				if (a.timestamp > b.timestamp) return -1;
				if (a.timestamp < b.timestamp) return 1;
				return 0;
			})
			.map( x=> {
				const timestamp = new Date(x.timestamp).toLocaleTimeString();
				return {
					timestamp,
					name: game.users!.get(x.player_id)!.name,
					total: x.roll.total,
					used: x.used,
					terms: TaragnorSecurity.getResultsArray(x.roll),
					formula: x.roll.formula,
					status: x.status
				};
			});
		const html = await renderTemplate("modules/gm-paranoia-taragnor/hbs/roll-log.hbs", { logs});
		return await this.logDialog(html);
	}

	logDialog(html: string) {
		return new Promise( (conf, _rej) => {
			const options = { width: 700 };
			const dialog = new Dialog ( {
				title : "Roll Log",
				content :html,
				buttons : {
					one: {
						icon: `<i class="fas fa-check"></i>`,
						callback: () => conf(null),
					}
				},
				close: () => conf(null),
			}, options);
			dialog.render(true);
		});
	}

} //end of class



