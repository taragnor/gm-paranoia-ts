export function getGame(): Game {
	const g = game;
	if (g != undefined && "actors" in g) {
		return g;
	}
	else throw new Error("Tried to get Game and failed");

}

export function localize(str: string): string {
	const game = getGame();
	return game.i18n.localize(str);
}

/** return string if localization worked else return null */
export function try_localize(str: string) {
	const local = localize(str);
	if (local == str) return null;
	else return local;
}

type Handler = (data: Object, payloadData?: SocketPayload) => (boolean | Promise<unknown>);

declare global {

	interface SocketPayload {
		command: string;
		data: Object;
		num: number;
		targets: string[];
		sender: string;
		expectReply: boolean;
	}

	interface TransactionData {
		resolve: (value: unknown) => void;
		reject: (value: unknown) => void;
		num: number;
	}
}


const ERROR_CODE_STRING = "ERROR_ON_TRANSMISSION";

export class Sockets {
	static handlers: Map<string, Handler[]>;
	static socketName : string;
	static count: number
	static transactions: Map<string, TransactionData[]>


	static init(moduleName : string) {
		this.handlers = new Map();
		this.transactions= new Map();
		this.socketName = `module.${moduleName}`;
		this.count = 0;
		const game = getGame();
		game.socket!.on(this.socketName, this.socketHandler.bind(this));
	}

	static send(command: string, data: any, targetList ?: string[], expectReply: boolean = false) {
		this._send(command, data, targetList, expectReply);
		return this.count++;
	}

	private static _send(command: string, data:any, targetList ?: string[], expectReply: boolean = false, count: number = this.count) {
		const game = getGame();
		const targets = targetList ?? getGame().users!.map( x=> x.id);
		const payload: SocketPayload = {
			command,
			data,
			num: count,
			targets,
			sender: game.user!.id,
			expectReply
		};
		game.socket!.emit(this.socketName, payload);
	}

	static addHandler(command: string, handler: Handler) {
		let array = this.handlers.get(command);
		if (!array) {
			array = new Array();
			this.handlers.set( command, array);
		}
		if (!handler)
			throw new Error("No handler given");
		array.push(handler);
	}

	static async socketHandler(payload: SocketPayload) : Promise<void> {
		const {command, data, targets} = payload;
		// console.log(`Handler called for ${command}`);
		if (!targets.includes(getGame().user!.id))
			return;
		const handlerArray = this.handlers.get(command);
		if (!handlerArray) {
			return this.tryTransactions(payload);
		}
		for (const handler of handlerArray) {
			try {
			const handlerRet = await handler(data, payload);
			if (payload.expectReply)
				this._send(command, handlerRet, [payload.sender], false, payload.num);
			if (handlerRet)
				return;
			} catch (e) {
				if (payload.expectReply)
					this._send(command, ERROR_CODE_STRING, [payload.sender], false, payload.num);
				throw e;
			}
		}
	}

	static tryTransactions(payload: SocketPayload) {
		const {command, data, num} = payload;
		const transactionList = this.transactions.get(command) ?? [];
		const transactions = transactionList
			.filter(x=> x.num == num)
		if (transactions.length == 0) {
			console.warn (`No handler or transaction for ${command}`);
			return;
		}
		for (const transaction of transactions) {
			if (data != ERROR_CODE_STRING)
				transaction.resolve(data);
			else
				transaction.reject(ERROR_CODE_STRING);
		}
		this.transactions.set(command,
			transactionList.filter(x=> x.num != num));
	}

	static async simpleTransaction(command: string, data: any, targetList ?: string[]): Promise<unknown>  {
		const count = this.send(command, data, targetList, true);
		return await new Promise( (conf, rej) => {
			const transList = this.transactions.get(command) ?? [];
			transList.push( {
				resolve: conf,
				reject: rej,
				num: count
			});
			this.transactions.set(command, transList);
			setTimeout( () => rej("Timeout"), 5000);
		});
	}

}

