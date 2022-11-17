import {getGame, try_localize} from "./foundry-tools.js";

export class ChangeGroup {
	id: string; //ID of changed object
	playerId: string; //player who changed
	changes: RecursiveArray<ChangeEntry>;
	time: number;

	constructor(id: string, IdOfChanger : string, time = Date.now()) {
		this.id = id;
		this.playerId = IdOfChanger;
		this.changes = [];
		this.time = time;
	}

	get userName() {
		const game = getGame();
		return game.users!.find(x => x.id == this.playerId) ?? "Unknown";
	}

	get humanReadableTime() {
		//@ts-ignore
		return timeSince( this.time);
	}

	add(key : string, oldValue: any, newValue: any) {
		this.changes.push ( {
			key, oldValue, newValue
		});
	}

	addChangeEntries( entry:RecursiveArray<ChangeEntry>) {
		this.changes= this.changes.concat(entry);
	}

	localizeKey(key: string) {
		const keyparts = key.split(".");
		keyparts.map( x=> {
			return try_localize(x) ?? x;
		})
		.join(" -> ");
	}

	merge (other: ChangeGroup) {
		if (this.id != other.id)
			throw new Error("Trying to merge changegroups where ID doesn't match");
		if (this.playerId != other.playerId)
			throw new Error("Trying to merge changegroups where playerId doesn't match");
		this.changes = this.changes.concat(other.changes);
	}




}

export interface ChangeEntry {
	oldValue: any;
	key: string;
	newValue: any;
}


export type RecursiveArray<T> = (T | T[])[];

