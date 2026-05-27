// Victory poems for the round-end flourish, lifted in spirit from the
// original project's PoemService. Inlined here rather than seeded to KV
// because the list is small, public-domain, and never edited at runtime
// — KV would just add an extra read on every round end.
//
// Each entry is one classical four-line poem fitting the typewriter
// reveal (~30-50 CJK chars + author tag). Plain author + title; no
// translations — the audience is CJK readers.

import type { Poem } from "../shared/protocol";

const POEMS: Poem[] = [
	{
		text: "床前明月光,疑是地上霜。举头望明月,低头思故乡。",
		author: "李白《静夜思》",
	},
	{
		text: "白日依山尽,黄河入海流。欲穷千里目,更上一层楼。",
		author: "王之涣《登鹳雀楼》",
	},
	{
		text: "红豆生南国,春来发几枝。愿君多采撷,此物最相思。",
		author: "王维《相思》",
	},
	{
		text: "春眠不觉晓,处处闻啼鸟。夜来风雨声,花落知多少。",
		author: "孟浩然《春晓》",
	},
	{
		text: "千山鸟飞绝,万径人踪灭。孤舟蓑笠翁,独钓寒江雪。",
		author: "柳宗元《江雪》",
	},
	{
		text: "空山不见人,但闻人语响。返景入深林,复照青苔上。",
		author: "王维《鹿柴》",
	},
	{
		text: "锄禾日当午,汗滴禾下土。谁知盘中餐,粒粒皆辛苦。",
		author: "李绅《悯农》",
	},
	{
		text: "向晚意不适,驱车登古原。夕阳无限好,只是近黄昏。",
		author: "李商隐《登乐游原》",
	},
];

export function pickRandomPoem(rng: () => number = Math.random): Poem {
	return POEMS[Math.floor(rng() * POEMS.length)];
}
