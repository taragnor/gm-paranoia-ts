class Combatant<T extends Actor<any, any> = Actor<any,any>> extends FoundryDocument<never> {
	actorId: string;
	defeated: boolean;
	name: string;
	hidden: boolean;
	sceneId: string;
	tokenId: string;
	img: string;
	get actor(): T  | undefined;
	get combat(): Combat<T>;
	get isDefeated(): boolean;
	get isEmbedded(): boolean;
	get isNPC(): boolean;
	get token(): TokenDocument<T>;


}
