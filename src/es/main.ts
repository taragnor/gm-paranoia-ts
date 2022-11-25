import { } from "./roller-patch.js";
import {DiceSecurity} from "./diceSecurity.js";
import {ChangeLogger} from "./dataSecurity.js";
import {SecuritySettings} from "./security-settings.js";
import {SecurityHandlebarsStuff} from "./handlebars-stuff.js";
import {ChangelogDialog} from "./changelog-dialog.js";

import {Sockets} from "./foundry-tools";

Hooks.on("ready",  () => {
	//DEBUG
	//@ts-ignore
	window.ChangelogDialog = ChangelogDialog;
	Sockets.init();
	SecurityHandlebarsStuff.init();
	SecuritySettings.init();
	if (SecuritySettings.monitorChanges())
		ChangeLogger.init();
	if (SecuritySettings.monitorDiceRolls())
		DiceSecurity.SecurityInit();
});


