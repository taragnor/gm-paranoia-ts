import { } from "./roller-patch.js";
import {DiceSecurity} from "./diceSecurity.js";
import {DataSecurity} from "./dataSecurity.js";

Hooks.on("ready", DataSecurity.init.bind(DataSecurity));
Hooks.on("ready", DiceSecurity.SecurityInit.bind(DiceSecurity));

export function getGame(): Game {
	const g = game;
	if (g != undefined && "actors" in g) {
		return g;
	}
	else throw new Error("Tried to get Game and failed");

}

