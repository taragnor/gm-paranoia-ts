export class ChangeGroup {
	id: string; //ID of changed object
	playerId: string; //player who changed
	changes: RecursiveArray<ChangeEntry>;

	constructor(id: string, IdOfChanger : string) {
		this.id = id;
		this.playerId = IdOfChanger;
		this.changes = [];
	}

	add(key : string, oldValue: any, newValue: any) {
		this.changes.push ( {
			key, oldValue, newValue
		});
	}

	addChangeEntries( entry:RecursiveArray<ChangeEntry>) {
		this.changes= this.changes.concat(entry);
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

