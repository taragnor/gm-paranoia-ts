import {getGame, try_localize} from "./foundry-tools.js";

export class ChangeGroup {
	id: string; //ID of changed object
	parentId: string; //ID of owned items parent
	playerId: string; //player who changed
	changes: RecursiveArray<ChangeEntry>;
	time: number;
	type: "Actor" | "Item";

	constructor(id: string, type: "Actor" | "Item", IdOfChanger : string, parentId: string = "", time = Date.now()) {
		this.id = id;
		this.type = type;
		this.playerId = IdOfChanger;
		this.changes = [];
		this.time = time;
		this.parentId = parentId;
	}

	get userName() {
		const game = getGame();
		return game.users!.find(x => x.id == this.playerId)?.name ?? "Unknown";
	}

	get humanReadableTime() {
		//@ts-ignore
		return timeSince( this.time);
	}

	getItem() {
		const game = getGame();
		switch (this.type) {
			case "Item":
				if (this.parentId) {
					const parent = game.actors!.get(this.parentId);
					if (!parent) return null;
					return parent.items.get(this.id);
				} else
					return game.items!.get(this.id);
			case "Actor":
				return game.actors!.get(this.id);
			default:
				return null;
		}
	}

	get itemName() {
		const item = this.getItem();
		if (!item)
			return `${this.type} ( ${this.id} )`;
		switch (this.type) {
			case "Item":
				const name =  item.name;
				const parent = item.parent?.name;
				if (parent) {
					return `${parent} (${name} [${item.type}])`;
				}
				return name;
			case "Actor":
				return item.name;
			default:
				return `Unknown ${this.id}`;
		}
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

