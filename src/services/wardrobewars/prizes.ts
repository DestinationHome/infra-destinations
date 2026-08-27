/**
 * The 70 `Wardrobe Wars - ...` prize objects that shipped with the game, split
 * into the four reward tiers the client knows about (`WWScreenRewardLookup`).
 *
 * Object IDs were taken from the live HCDB, so `ObjectRetrieveMetaData` resolves
 * every one of them to a real name and description on the client.
 *
 * Tiering follows what the items actually are, since the retail schedule is not
 * recoverable: accessories are the everyday participation give-away, individual
 * garments are daily-winner prizes, the signature hero / dark-armour / catwalk
 * sets are weekly, and the full male+female costume bundles are monthly.
 */

export interface Prize {
  /** HCDB object GUID, handed to `Rewards.AddTicket` on the client. */
  objectId: string;
  /** Catalogue name minus the shared `Wardrobe Wars - ` prefix. */
  name: string;
}

export const REWARD_PARTICIPANT = 1;
export const REWARD_DAILY_WIN = 2;
export const REWARD_WEEKLY_WIN = 3;
export const REWARD_MONTHLY_WIN = 4;

export type RewardType =
  | typeof REWARD_PARTICIPANT
  | typeof REWARD_DAILY_WIN
  | typeof REWARD_WEEKLY_WIN
  | typeof REWARD_MONTHLY_WIN;

/** Accessories, rotated daily as the reward for entering. */
export const PARTICIPANT_PRIZES: Prize[] = [
  { objectId: "59FAD74C-B7024B03-A18A0838-C7BF9A11", name: "Backpack - Blue Meanie - Female" },
  { objectId: "882270E3-4C5A4801-9CFB468B-3587FBE7", name: "Backpack - Damask - Female" },
  { objectId: "9B1C1596-C33F40D7-BDDE3015-1E734F15", name: "Backpack - Damask Purple - Female" },
  { objectId: "0D477D8B-95CD48EC-966C0844-C9FCE8B0", name: "Backpack - Denim - Female" },
  { objectId: "F8A948E5-E5AA4A64-B7CFDE45-242F6A7E", name: "Backpack - Gambler - Male" },
  { objectId: "F7098118-37D545BF-B05BEB1C-59E8E1E5", name: "Backpack - Scotty - Male" },
  { objectId: "FDB11ACA-A6894039-9CB081C3-1DDB434E", name: "Backpack - Skull - Male" },
  { objectId: "1A996DEE-52A949D7-8D3EE1E8-BA34966B", name: "Backpack - Surfs Up - Male" },
  { objectId: "3BF665A5-951A4BF3-B816EDAC-5F847C7A", name: "Fedora - Blue Meanie - Female" },
  { objectId: "E1589B1C-B9B042CB-B0CBA498-DDA5963F", name: "Fedora - Damask - Female" },
  { objectId: "F2BCD848-BE364165-9F56B4DA-47D56EED", name: "Fedora - Damask Purple - Female" },
  { objectId: "2E224181-34A447E0-90DDCF21-7A5BE5C6", name: "Fedora - Denim - Female" },
  { objectId: "FD276AF2-9861495E-A1C1FD03-41B8F638", name: "Fedora - Gambler - Male" },
  { objectId: "7A55B804-AFE9421D-AB8DE39E-63F05B12", name: "Fedora - Mercury - Male" },
  { objectId: "17493399-85B24C2F-A3983D5C-D4914D44", name: "Fedora - Scotty - Male" },
  { objectId: "A2906B0B-1F394F4B-AEE3BA16-1FCF9801", name: "Fedora - Skull - Male" },
  { objectId: "7317B2F8-FFEA4711-9BF88CF5-20082C07", name: "Fedora - Surfs Up - Male" },
  { objectId: "B5EAD2C6-B0684A04-90B60E86-199AF8A9", name: "Hairstyle - Catwalk - Female" },
  { objectId: "F9258E40-5BF946C9-8DB88E7E-CBAAC91E", name: "Hairstyle - Glam Punk - Female" },
  { objectId: "1C809E96-01A24BF3-A2125FA5-2D0A7CA0", name: "Hairstyle - Justin - Male" },
  { objectId: "1DB7FC04-1C5B4E5E-8F21A0A5-5E16DF49", name: "Hairstyle - Mary Jane - Female" },
  { objectId: "07A4FD1F-161244F6-9EE35DCC-5C212EAE", name: "Sneakers - Blue Meanie - Female" },
  { objectId: "CBB3DDAA-1F914554-906C81A3-52B275E0", name: "Sneakers - Damask - Female" },
  { objectId: "F97419F9-6FC847FE-922C3610-DA339E96", name: "Sneakers - Damask Purple - Female" },
  { objectId: "2722E3B3-B2254C5B-88746292-02414321", name: "Sneakers - Denim - Female" },
  { objectId: "94FF870E-6CF44052-BB7ABB78-A4A1596D", name: "Sneakers - Gambler - Male" },
  { objectId: "7AE1B02D-22DD4FBB-BA158391-4BF4CE20", name: "Sneakers - Mercury - Male" },
  { objectId: "C497ABEB-1BAC42E3-BAF2F8FC-AF511B81", name: "Sneakers - Scotty - Male" },
  { objectId: "184C1A25-C4DD4D74-A8295DC3-1DE9293B", name: "Sneakers - Skull - Male" },
  { objectId: "EBED5ABD-B8D442F0-B8EB7ED9-F8E925C0", name: "Sneakers - Surfs Up - Male" },
];

/** Individual garments, rotated daily as the daily winner's prize. */
export const DAILY_PRIZES: Prize[] = [
  { objectId: "13EF9A0B-63974DE9-819F7B48-A7CB49D5", name: "Card Shark Fedora - Male" },
  { objectId: "0F6AB313-E038402D-A4C2068B-46DB1BA6", name: "Card Shark Suit Jacket - Female" },
  { objectId: "B882F796-DDCE463F-8F5B6D07-72E249F9", name: "Card Shark Suit Jacket - Male" },
  { objectId: "26CA68C0-20F74A76-9FDEEDDF-07E48A97", name: "Card Shark Suit Pants - Female" },
  { objectId: "28F7BF7C-A89E406C-9F69F107-F7B74DC1", name: "Card Shark Suit Pants - Male" },
  { objectId: "5D59ECC6-10384631-A930F643-97EEA6AC", name: "Catwalk Earring - Left - Female" },
  { objectId: "3D6B75DD-BDAD49E7-8A56E56D-55E3EE9D", name: "Catwalk Earring - Right - Female" },
  { objectId: "437ED801-AECD4C6D-A4B49C6A-22A1ED37", name: "Catwalk Purse and Wrist Jewelry - Female" },
  { objectId: "014538E5-289A41AF-9AE0A039-30E3D4E5", name: "Collegiate dress - Black - Female" },
  { objectId: "35F17E7D-CBE84B93-90D80492-EF1A0C15", name: "Collegiate dress - Blue - Female" },
  { objectId: "3006D78F-347A4C8D-84958221-2506E842", name: "Collegiate dress - Purple - Female" },
  { objectId: "B9BCB5C3-D5094DE4-A50D398C-BA8FFC4F", name: "Collegiate dress - Red - Female" },
  { objectId: "BE9B380B-DCFE4A36-9DCEA0F2-5CD266CE", name: "Glam Punk Gloves - Female" },
  { objectId: "7B89739D-39AB4489-9D3079A5-2FCAC6AE", name: "Glam Punk Jacket - Female" },
  { objectId: "339331D3-02214487-A9E08F52-92CB0FAF", name: "Glam Punk Pants - Female" },
  { objectId: "8A8E1721-E8904B42-8A877032-59DF0A7E", name: "Glam Punk Sandals - Female" },
  { objectId: "570299A6-58D24499-B1B048FD-4094C385", name: "Letterman - Black - Male" },
  { objectId: "9FDAA17E-92624896-A029B652-75D739E5", name: "Letterman - Red - Male" },
  { objectId: "C0B97034-74534927-BB433690-D3D4A751", name: "Letterman - Scotty - Male" },
  { objectId: "494311C5-ECA24905-913B786F-31FE7B2A", name: "Letterman - Skull - Male" },
  { objectId: "A40C5E35-DF35440E-9AD2D159-8DC0D25F", name: "Loose Neck Dress - Argent - Female" },
  { objectId: "DF7977BE-28684CDE-A2FE030B-7416242A", name: "Shirt and Waistcoat - Male" },
  { objectId: "8805F215-A28E4E97-84C73281-B2F78410", name: "Suit Trousers - Male" },
  { objectId: "16FA860F-E86A457B-A28A238B-2ACA6E3D", name: "Sweatsuit - Black - Female" },
  { objectId: "8A8A2DA6-96BA4106-BF12A59B-973C6891", name: "Sweatsuit - Blue - Female" },
  { objectId: "B99FD173-CAF847AC-AD54D6A4-CC642DC2", name: "Sweatsuit - Gambler - Male" },
  { objectId: "DE5BE1E7-2AA84D9A-AA8BBF80-670276DE", name: "Sweatsuit - Skull - Male" },
  { objectId: "0096AD1C-D1404D6F-A577DD12-A503D172", name: "Wide Lapel Jacket - Blue - Female" },
];

/** Signature sets, rotated weekly as the weekly winner's prize. */
export const WEEKLY_PRIZES: Prize[] = [
  { objectId: "2C29225E-8DB74563-91361558-C52B9757", name: "Catwalk Outfit - Female" },
  { objectId: "6D06F0C1-88E7473B-9F6D011C-44DB8B15", name: "Dark Armor - Male" },
  { objectId: "2BD80DF9-72F24AA6-B1018242-A626E781", name: "Dark Armor Gauntlets with Axe - Male" },
  { objectId: "E1E4FEE8-6EC84B48-84821499-1FDDA738", name: "Dark Armor Glowing Eyes - Male" },
  { objectId: "C54780BF-809348B2-9E21A62C-F08205AE", name: "Dark Armor Helmet - Male" },
  { objectId: "F4C442F4-360C45B8-85635CDA-C3B53ED9", name: "Hero Armor - Male" },
  { objectId: "4D9F62CD-85914AD0-9D24C169-EE414640", name: "Hero Glowing Eyes - Male" },
  { objectId: "E0E75DE5-0E214C66-A83E6612-67DE4AB7", name: "Hero Hair - Male" },
  { objectId: "237A64D9-6AA24036-98F99868-33B84D29", name: "Hero Sword - Male" },
];

/** Full costume bundles, rotated monthly as the monthly winner's prize. */
export const MONTHLY_PRIZES: Prize[] = [
  { objectId: "218B4D31-D7034A67-8475EA57-7D5C2AB1", name: "Card Shark Male - Card Shark Female - Costumes" },
  { objectId: "4B992921-4EFB40BD-BF7DA303-91BADF2C", name: "Dark Armor - Catwalk - Costumes" },
  { objectId: "15D82AC5-16BC4FF4-88F9183C-B70A17CD", name: "Hero Armor - Glam Punk - Costumes" },
];

const POOLS: Record<RewardType, Prize[]> = {
  [REWARD_PARTICIPANT]: PARTICIPANT_PRIZES,
  [REWARD_DAILY_WIN]: DAILY_PRIZES,
  [REWARD_WEEKLY_WIN]: WEEKLY_PRIZES,
  [REWARD_MONTHLY_WIN]: MONTHLY_PRIZES,
};

/**
 * The prize on offer for a tier in a given period.
 *
 * `rotation` is a monotonic period counter (day/week/month index), so the pool
 * cycles deterministically and every client in the space agrees on the answer
 * without any shared state.
 */
export function prizeFor(type: RewardType, rotation: number): Prize | undefined {
  const pool = POOLS[type];
  if (!pool || pool.length === 0) return undefined;
  const index = ((rotation % pool.length) + pool.length) % pool.length;
  return pool[index];
}

/** Every prize, for lookups by object id. */
export const ALL_PRIZES: Prize[] = [
  ...PARTICIPANT_PRIZES,
  ...DAILY_PRIZES,
  ...WEEKLY_PRIZES,
  ...MONTHLY_PRIZES,
];
