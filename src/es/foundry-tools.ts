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

export class Sockets {
	static init() {
		const game = getGame();
		game.socket!.on("module.gm-paranoia-taragnor", this.socketHandler.bind(this));
	}

	static send(data: any) {
		const game = getGame();
		game.socket!.emit('module.gm-paranoia-taragnor', data);
	}

	static socketHandler(data: any) {
		//need to convert over old socket handler to universal model
	}

}


