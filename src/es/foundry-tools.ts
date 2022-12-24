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

type Handler = (data: Object) => (boolean | Promise<boolean>);

declare global {

	interface SocketPayload {
		command: string;
		data: any;
	}
}

export class Sockets {
	static handlers: Map<string, Handler[]>;
	static socketName : string;


	static init(moduleName : string) {
		this.handlers = new Map();
		this.socketName = `module.${moduleName}`;
		const game = getGame();
		game.socket!.on(this.socketName, this.socketHandler.bind(this));
		// game.socket!.on("module.gm-paranoia-taragnor", this.socketHandler.bind(this));
	}

	static send(command: string, data: any) {
		const payload: SocketPayload = {
			command,
			data,
		};
		const game = getGame();
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

	static async socketHandler(payload: SocketPayload) {
		const {command, data} = payload;
		// console.log(`Handler called for ${command}`);
		const handlerArray = this.handlers.get(command);
		if (!handlerArray) {
			console.warn (`No handler for ${command}`);
			return;
		}
		for (const handler of handlerArray) {
			if (await handler(data)) return;
		}
	}

}

//@ts-ignore
window.Sockets =Sockets
