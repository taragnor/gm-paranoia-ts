import { } from "./roller-patch.js";
import {DiceSecurity} from "./diceSecurity.js";
import {ChangeLogger} from "./dataSecurity.js";
import {SecuritySettings} from "./security-settings.js";


Hooks.on("ready",  () => {
	SecuritySettings.init();
	if (SecuritySettings.monitorChanges())
		ChangeLogger.init();
	if (SecuritySettings.monitorDiceRolls())
		DiceSecurity.SecurityInit();
});


