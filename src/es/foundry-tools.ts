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
