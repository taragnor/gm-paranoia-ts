
export function Debug(thing: any) {
	if (Debug["_DList"] == null)
		Debug["_DList"]= [];
	Debug["_DList"].unshift(thing);
}


export function DLog (num : null | number = null) {
	if (num === null)
		return Debug["_DList"];
	else return Debug["_DList"][num];
}

export function nullcheck<T>(thing: undefined | null | T): thing is T {
	if (thing == undefined)
		throw new Error("Attempting to get undefined Value");
	return true;
}


if (window["DLog"]  == undefined)
	window["DLog"] = DLog;

////Debug code to trace what hooks are being called
//Hooks.callAll_orig = Hooks.callAll
//Hooks.callAll = function(...args) {
//	console.log(`called ${args[0]}`);
//	Hooks.callAll_orig.apply(this, args);
//}


