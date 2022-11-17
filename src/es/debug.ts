
let DebugList : any[] = []

export function Debug(...things: any) {
	if (DebugList == null)
		DebugList = [];
	for (const thing of things)
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

if (window != null) {
	window.Debug = Debug
	window.DLog = DLog
}
