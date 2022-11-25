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

type Handler = (data: Object) => boolean;

declare global {
	enum SocketCommand {
		Test = "TEST",
	}

	type SocketCommandString = SocketCommand;

	interface SocketPayload {
		command: SocketCommandString;
		data: any;
	}
}

export class Sockets {
	static handlers: Map<SocketCommandString, Handler[]>;


	static init() {
		const game = getGame();
		game.socket!.on("module.gm-paranoia-taragnor", this.socketHandler.bind(this));
	}

	static send(command: SocketCommandString, data: any) {
		const payload: SocketPayload = {
			command,
			data,
		};
		const game = getGame();
		game.socket!.emit('module.gm-paranoia-taragnor', payload);
	}

	static addHandler(command: SocketCommandString, handler: Handler) {
		let array = this.handlers.get(command);
		if (!array) {
			array = [];
			this.handlers.set( command, []);
		}
		array.push(handler);
	}

	static socketHandler(payload: SocketPayload) {
		const {command, data} = payload;
		const handlerArray = this.handlers.get(command);
		if (!handlerArray) {
			console.warn (`No handler for ${command}`);
			return;
		}
		for (const handler of handlerArray) {
			if (handler(data)) return;
		}
	}

}

Sockets.addHandler( SocketCommand.ROLL_REQUEST, () => true)

