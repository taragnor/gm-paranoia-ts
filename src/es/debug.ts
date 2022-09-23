
let DebugList : any[] = []

export function Debug(thing: any) {
	if (DebugList == null)
		DebugList = [];
	DebugList.unshift(thing);
}


export function DLog (num : null | number = null) {
	if (num === null)
		return DebugList;
	else return DebugList[num];
}

export function nullcheck<T>(thing: undefined | null | T): thing is T {
	if (thing == undefined)
		throw new Error("Attempting to get undefined Value");
	return true;
}

declare global {
	interface Window {
		DLog: (index: null | number) => any;
		Debug: (thing: any) => void;
	}
}

window.Debug = Debug
window.DLog = DLog

