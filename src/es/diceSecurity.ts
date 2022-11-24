import { SecurityLogger } from "./security-logger.js";
import {getGame, localize} from "./foundry-tools.js";
import {Debug } from "./debug.js";


declare global {
	interface ValidCommandCodes {
		ROLL_MADE : "ROLL_MADE";
		ROLL_ERROR : "ROLL_ERROR";
		ROLL_REQUEST : "ROLL_REQUEST";
		PUNISH_MONGREL: "CHEATER_DETECTED";
		DIAGNOSTIC: "DIAGNOSTIC";
		REPORT_IN : "PLAYER_REPORT_IN";
		REQUEST_REPORT : "GM_REQUEST_REPORT";
		REPORT_ACK : "GM_ACKNOWLEDGE_REPORT";
	}
}

export class DiceSecurity {
	static logger : SecurityLogger;
	static logpath = "";
	static codes = {
		ROLL_MADE : "ROLL_MADE",
		ROLL_ERROR : "ROLL_ERROR",
		ROLL_REQUEST : "ROLL_REQUEST",
		PUNISH_MONGREL: "CHEATER_DETECTED",
		DIAGNOSTIC: "DIAGNOSTIC",
		REPORT_IN : "PLAYER_REPORT_IN",
		REQUEST_REPORT : "GM_REQUEST_REPORT",
		REPORT_ACK : "GM_ACKNOWLEDGE_REPORT",
	} as const;

	static async SecurityInit() {
		const game = getGame();
		if (game.user!.isGM)
			console.log("*** SECURITY ENABLED ***");
		game.socket!.on("module.gm-paranoia-taragnor", this.socketHandler.bind(this));
		this.logger = new SecurityLogger(this.logpath);
		if (this.replaceRollProtoFunctions)
			this.replaceRollProtoFunctions();
		this.initialReportIn();
		Hooks.on("renderChatMessage", this.verifyChatRoll.bind(this));
		Object.freeze(this);

	}

	static get reasons() {
		return {
			"unused_rolls": localize("TaragnorSecurity.diceProtection.reasons.unused_rolls"),
			"no-report": localize("TaragnorSecurity.diceProtection.reasons.no-report"),
			"stale": localize("TaragnorSecurity.diceProtection.reasons.stale"),
			"verified": localize("TaragnorSecurity.diceProtection.reasons.verified"),
			"roll_modified": localize("TaragnorSecurity.diceProtection.reasons.roll_modified"),
			"not found": localize("TaragnorSecurity.diceProtection.reasons.not_found"),
			"roll_used_multiple_times":localize("TaragnorSecurity.diceProtection.reasons.used_multiple_times"),
			"already_done": "",
			"unused": "",
			"no-roll": "",
		} as const;

	}

	static rollRequest(dice_expr = "1d6", timestamp: number, targetGMId:string) {
		const game = getGame();
		this.socketSend( {
			command: this.codes.ROLL_REQUEST,
			target: targetGMId,
			gm_id: targetGMId,
			rollString: dice_expr,
			timestamp,
			player_id: game.user!.id
		});
	}

	static dispatchCheaterMsg(player_id : string, infraction: string, rollId: number) {
		this.socketSend( {
			command: this.codes.PUNISH_MONGREL,
			target: player_id,
			infraction,
			player_id,
			rollId
		});
	}

	static rollSend(dice: string, GMtimestamp:number, player_id:string, player_timestamp:number, log_id: number) {
		this.socketSend({
			command:this.codes.ROLL_MADE,
			target: player_id,
			dice,
			timestamp: GMtimestamp,
			player_id,
			player_timestamp: player_timestamp,
			log_id
		});
	}

	static rollErrorSend(player_id: string, player_timestamp: number) {
		this.socketSend( {
			command:this.codes.ROLL_ERROR,
			target: player_id,
			player_id,
			player_timestamp: player_timestamp
		});
	}

	static async rollRecieve({dice: rollData, player_timestamp, player_id, timestamp: gm_timestamp, log_id}: RollSendData) {
		try {
			const game = getGame();
			const roll = Roll.fromJSON(rollData!) as RollType;
			if (roll.options._securityTS == undefined) {
				console.log(rollData);
				Debug(roll);
				// console.warn("No security Data");
				throw new Error("NO security data");
			}
			const awaited = this.logger.awaitedRolls.find( x=> x.timestamp == player_timestamp && player_id == game.user!.id);
			if (Number.isNaN(roll.total) || roll.total == undefined) {
				throw new Error("NAN ROLL");
			}
			if (!awaited) {
				throw new Error("No roll found on logged");
			}
			awaited.resolve({roll, gm_timestamp: gm_timestamp!, log_id: log_id!});
			this.logger.awaitedRolls = this.logger.awaitedRolls.filter (x => x != awaited);
			return {roll, gm_timestamp, log_id};
		} catch (e) {
			console.error(e);
			console.log(rollData);
			return rollData;
		}
	}

	static async rollRecieveError({player_timestamp, player_id}: RollSendData) {
		const game = getGame();
		console.log(`${player_timestamp}, ${player_id}`);
		const awaited = this.logger.awaitedRolls.find( x=> x.timestamp == player_timestamp && player_id == game.user!.id);
		this.logger.awaitedRolls = this.logger.awaitedRolls.filter (x => x != awaited);
		if (awaited) {
			Debug(awaited);
			awaited.reject("some reason");
		} else throw new Error ("No awaited roll somehow?");
	}

	static async sendDiagnostic({gm_id, rollId} : {gm_id: string, rollId: number}) {
		let diagnostics : ArbitraryObject = {};
		for ( const x of Object.getOwnPropertyNames(Roll.prototype)) {
			const prop = (Roll.prototype as ArbitraryObject)?.x;
			const propType = typeof prop;
			if (propType == 'undefined')
				continue;
			if (propType == 'function') {
				diagnostics[x] = prop.toString();
			}
		}
		this.socketSend({
			target: gm_id,
			command:this.codes.DIAGNOSTIC,
			diagnostics,
			rollId
		});
	}

	static replaceRoll(roll:Roll, rollData: Roll) {
		for (let i = 0; i < rollData.terms.length; i++)
			if (rollData.terms[i].results) //check for 0 dice rolls
				for (let j = 0; j< rollData.terms[i].results.length; j++)
					if (rollData.terms[i].results) //check for 0 dice rolls
						roll.terms[i].results[j] = rollData.terms[i].results[j];
		//@ts-ignore
		roll._total = rollData.total;
		//@ts-ignore
		roll._evaluated = true;
		return roll;
	}

	static socketSend(data: RollSendData) {
		const game = getGame();
		game.socket!.emit('module.gm-paranoia-taragnor', data);
	}

	static async recievedRollRequest({gm_id, rollString, player_id, timestamp}: RollSendData) {
		const game = getGame();
		if (!game.user!.isGM || game.user!.id != gm_id) {
			console.log("Disregarding recieved roll request");
			console.log(`${gm_id}`);
			return;
		}
		// console.log(`Recieved request to roll ${rollString}`);
		let roll : RollType = Roll.fromJSON(rollString!) as RollType;
		// const dice = new Roll(rollString);
		try {
			if (!roll.total)
				//@ts-ignore
				roll._evaluated = false;
			roll = await roll.evaluate({async:true});
		} catch (e) {
			Debug(roll);
			console.warn("returning Roll Error");
			this.rollErrorSend(player_id!, timestamp!);
			return;
		}
		const log_id = this.logger.getNextId();
		// this._displayRoll(roll); // NOTE: debug code
		const gm_timestamp = this.logger.getTimeStamp();
		roll.options._securityTS = gm_timestamp;
		roll.options._securityId = log_id;
		roll.security = {
			TS: gm_timestamp,
			log_id
		};
		const json = roll.toJSON();
		this.rollSend(JSON.stringify(json), gm_timestamp, player_id!, timestamp!, log_id);
		if (!gm_timestamp)
			console.warn("No Timestamp provided with roll");
		await this.logger.logRoll(roll, player_id!, gm_timestamp);
	}

	static async cheatDetectRecieved({player_id, infraction, rollId} : RollSendData) {
		const game = getGame();
		if (game.user!.id != player_id)
			return;
		const GMId = game.users!.find( x=> x.isGM)?.id!;
		switch (infraction) {
			case "cheater":
				// console.log("CHEATING MONGREL DETECTED");
				await this.sendDiagnostic({gm_id: GMId, rollId: rollId!});
				break;
			case "sus":
				// console.log("YOU ARE SUS");
				await this.sendDiagnostic({gm_id: GMId, rollId: rollId!});
				break;
		}
	}

	static async recieveCheaterDiagnostic({diagnostics, rollId}: RollSendData) {
		const game = getGame();
		console.log("*** Diagnostic Recieved from suspected Cheater ***");
		let violations = new Array();
		for (const x in diagnostics) {
			//@ts-ignore
			if (diagnostics[x] != Roll.prototype[x]?.toString()) {
				console.warn(`Tampered function found in class Roll, function "${x}":\n ${diagnostics[x]}`);
				violations.push(`${x}:${diagnostics[x]}`);
			}
		}
		if (violations.length > 0) {
			const logs = game.messages!.filter(x=> {
				const roll : RollType = x.roll! as RollType;
				return roll.options._securityId == rollId;
			});
			for (let log of logs) {
				await this.updateLogFullCheat(log);
			}
		} else
				console.log("No signs of tampering with the Roll functions");
		return violations;
	}

	static async updateLogFullCheat(_log: unknown) {
		//TODO Finish
	}


	static async socketHandler(data: RollSendData) {
		const game = getGame();
		if (!data?.command)
			throw new Error("Malformed Socket Transmission");
		if (data.target != game.user!.id)
			return;
		switch (data.command) {
			case this.codes.ROLL_REQUEST:
				await this.recievedRollRequest(data);
				return true;
			case this.codes.ROLL_MADE:
				await this.rollRecieve(data);
				return true;
			case this.codes.ROLL_ERROR:
				if ("player_timestamp" in data)
					await this.rollRecieveError(data);
				return true;
			case this.codes.PUNISH_MONGREL:
				await this.cheatDetectRecieved(data);
				return true;
			case this.codes.DIAGNOSTIC:
					await this.recieveCheaterDiagnostic(data);
				return true;
			case this.codes.REPORT_IN:
				await this.reportInRecieved(data);
				return true;
			case this.codes.REQUEST_REPORT:
				await this.reportInRequested(data);
				return true;
			case this.codes.REPORT_ACK:
				await this.onAcknowledgePlayerReportIn(data);
				return true;
			default:
				console.warn(`Unknown socket command: ${data.command}`);
				console.log(data);
				return true;
		}
	}


	static async secureRoll (rollOrRollString: Roll | string): Promise<
	{
		roll: Roll,
		gm_timestamp: number,
		log_id: number
	}> {
		const game = getGame();
		let unevaluatedRoll : Roll;
		if (typeof rollOrRollString == "string") {
			//convert string roll to real roll
			unevaluatedRoll = new Roll(rollOrRollString);
		} else {
			unevaluatedRoll = rollOrRollString;
		}
		if (game.user!.isGM)  {
			return {
				roll: await unevaluatedRoll.evaluate({async: true}),
				gm_timestamp: Date.now(),
				log_id: -1,
			};
		}
		return await new Promise(( conf, rej) => {
			const timestamp = this.logger.getTimeStamp();
			this.logger.awaitedRolls.push( {
				playerId: game.user!.id,
				expr: unevaluatedRoll.formula,
				timestamp,
				resolve: conf,
				reject: rej,
			});
			const GMId = game.users!.find( x=> x.isGM)?.id;
			if (!GMId) {rej(new Error("No GM in game")); return;}
			const json = JSON.stringify(unevaluatedRoll.toJSON());
			this.rollRequest(json, timestamp, GMId);
			// this.rollRequest(unevaluatedRoll.formula, timestamp, GMId);
		});
	}


	static replaceRollProtoFunctions() {
		//Replaces the original evaluate function with new Roller
		//@ts-ignore
		const oldEval = Roll.prototype._evaluate;
		// Roll.prototype._oldeval = Roll.prototype._evaluate;

		//@ts-ignore
		Roll.prototype._evaluate = async function (this: RollType, options ={}) {
			const game = getGame();
			if (game.user!.isGM) {
				try {
					return oldEval.call(this, options);
				} catch (e) {
					Debug(this);
					throw e;
				}
			} else {
				// console.warn("Running Secure Client Roll");
				try {
					const {roll, gm_timestamp, log_id} = await DiceSecurity.secureRoll(this);
					DiceSecurity.replaceRoll(this, roll);
					this.options._securityTS = gm_timestamp;
					this.options._securityId = log_id;
					return this;
				}
				catch (e) {
					//@ts-ignore
					this._evaluated = false;
					throw e;
				}
			}
		}

	}

	static getResultsArray(roll: Roll): number[] {
			return roll.terms
				.filter( term => !term.isDeterministic)
				.map ( term => {
				return term.results.map( result=> result.result);
			}).flat();
	}

	static verifyChatRoll(chatmessage: ChatMessage, html: JQuery<HTMLElement>,_c: unknown,_d: unknown) : boolean{
		const game = getGame();
		if (!game.user!.isGM) return false;
		const timestamp = chatmessage.timestamp;
		if (!this.logger.startScan && timestamp > this.logger.startTime) {
			this.logger.startScan = true; //we've reached the new messages so we can start scanning
		}
		if (chatmessage.user!.isGM)
			return true;
		if (!this.logger.startScan)  {
			return true;
		}
		const player_id = chatmessage.user!.id;
		if (!chatmessage["rolls"]) {
			if (!html.hasClass("roll-verified")) //tries to resist forged roll-verified header on a non-roll message
				return true; }
		const rolls : RollType[] = chatmessage.rolls as RollType[] ?? [] ;
		const logger_response = this.logger.verifyRolls(rolls, timestamp, player_id!, chatmessage.id!);
		const verified = (rolls.length > 0) ? logger_response : "no-roll";
		// const insert_target = html.find(".message-header");
		const msg = this.reasons[verified];
		switch(verified) {
			case "already_done":
				console.log("Already Done");
				break;
			case "unused_rolls":
				this.susMessage(html, msg, chatmessage);
				break;
			case "no-report":
				this.susMessage(html, msg, chatmessage);
				break;
			case "stale":
				this.susMessage(html, msg, chatmessage);
				break;
			case "verified":
				this.verifyMessage(html, msg, chatmessage);
				break;
			case "roll_modified":
				this.cheaterMessage(html, msg, chatmessage);
				break;
			case "not found":
				this.susMessage(html, msg, chatmessage);
				break;
			case "roll_used_multiple_times":
				this.susMessage(html, msg, chatmessage);
				break;
			case "no-roll": //currently not used
				// this.cheaterMessage(html, "No Roll", chatmessage);
				break;
			default:
				this.susMessage(html, `unusual error ${verified}`, chatmessage);
				throw new Error(`Unusual Error ${verified}`);
				break;
		}
		return true;
	}

	static susMessage(html: JQuery<HTMLElement>, reason:string, chatmessage: ChatMessage) {
		const insert_target = html.find(".message-header");
		html.addClass("player-sus");
		const msg = localize("TaragnorSecurity.diceProtection.report.sus");
		$(`<div class="player-sus security-msg"> ${chatmessage.user!.name} ${msg} (${reason}) </div>`).insertBefore(insert_target);
		//TODO: need better way to find rollId now that rolls can be multiple
		const rollId= chatmessage.roll!.options._securityId;
		this.dispatchCheaterMsg(chatmessage.user!.id!, "sus", rollId );
	}

	static cheaterMessage(html: JQuery<HTMLElement>, reason: string, chatmessage: ChatMessage) {
		const insert_target = html.find(".message-header");
		html.addClass("cheater-detected");
		const msg = localize("TaragnorSecurity.diceProtection.report.cheater");
		$(`<div class="cheater-detected security-msg"> ${chatmessage.user!.name} ${msg} (${reason}) </div>`).insertBefore(insert_target);
		//TODO: need better way to find rollId now that rolls can be multiple
		const rollId= chatmessage.roll!.options._securityId;
		this.dispatchCheaterMsg(chatmessage.user!.id!, "cheater", rollId);
	}

	static verifyMessage(html: JQuery<HTMLElement>, _reason: string, _chatmessage: ChatMessage) {
		const insert_target = html.find(".message-header");
		const message = localize ('TaragnorSecurity.diceProtection.report.verified0') ;
		const insert = $(`<div class="roll-verified security-msg"> ${message} </div>`);
		this.startTextAnimation(insert);
		html.addClass("roll-verified");
		insert.insertBefore(insert_target);
	}

	static startTextAnimation (html: JQuery<HTMLElement>) {
		//NOTE: PROB BEST TO REPLACE THIS WITH CUSTOM GM MESSAGE FOR VERIFICATION TO PREVENT FORGERY
		const sleep = function(time: number)  {
			return new Promise ( (resolve, _reject) => {
				setTimeout(resolve, time);
			});
		}
		const changeText = async () =>  {
			await sleep(5000 + Math.random() * 10000);
			const original = html.text();
			html.text(localize (`TaragnorSecurity.diceProtection.report.verified1`) );
			await sleep(5000 + Math.random() * 10000);
			html.text(original);
			setTimeout(changeText, 10000 + Math.random() * 20000);
		}
		setTimeout(changeText, 1000);
	}

	static async _displayRoll(roll : Roll) {
		//DEBUG FUNCTION
		const map = roll.terms.map( x=> x.results.map(y=> y.result));
		console.log(`original terms: ${map} `);
		console.log(`original total: ${roll.total}`);
	}


	static async initialReportIn() {
		const game = getGame();
		const gm_id = game.users!.find( x=> x.isGM)?.id;
		if (game.user!.isGM)
			this.sendReportInRequests();
		else {
			if (gm_id)
				this.reportIn(gm_id);
		}
	}

	static async reportIn(gm_id: string) {
		const game = getGame();
		if (!this.logger.reported) {
			this.socketSend( {
				command: this.codes.REPORT_IN,
				target: gm_id,
				player_id: game.user!.id
			});
			setTimeout( this.reportIn.bind(this, gm_id), 5000);
		}
	}

	static async sendReportInRequest(player_id: string) {
		const game = getGame();
		this.socketSend( {
			command: this.codes.REQUEST_REPORT,
			target: player_id,
			gm_id: game.user!.id
		});
	}

	static async sendReportAcknowledge(player_id: string) {
		const game = getGame();
		this.socketSend( {
			command: this.codes.REPORT_ACK,
			target: player_id,
			gm_id: game.user!.id
		});
	}

	static async sendReportInRequests() {
		const game = getGame();
		for (const user of game.users!.filter( x=> !x.isGM))
			await this.sendReportInRequest(user.id);
	}

	static async reportInRecieved({player_id}: RollSendData) {
		if (!player_id)
			throw new Error("No Player Id");
		const game = getGame();
		const name = game.users!.get(player_id)?.name;
		console.debug(`${name} has reported in`);
		this.logger.playerSignIn(player_id);
		await this.sendReportAcknowledge(player_id);
	}

	static async reportInRequested({gm_id}: RollSendData) {
		if (!gm_id) throw new Error("No GM Id");
		this.logger.reported = false;
		await this.reportIn(gm_id);
	}

	static async onAcknowledgePlayerReportIn(_data: {}) {
		this.logger.reported = true;
	}
}

//INIT log button (probably should move this to the actual init,but need to manually add it or it will be gone initially
Hooks.on("getSceneControlButtons", function(controls:any) {
	const game = getGame();
	let tileControls = controls.find( (x: {name: string}) => x.name === "token");
	if (game.user!.isGM) {
		tileControls.tools.push({
			icon: "fas fa-dice",
			name: "DiceLog",
			title: "DiceLog",
			button: true,
			onClick: () => DiceSecurity.logger.viewLog()
		});
	}
});


