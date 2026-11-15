export type Question = {
  id: string; category: string; difficulty: "Easy" | "Medium" | "Hard";
  prompt: string; options: string[]; answer: number; explanation: string;
  provenance: "AI-generated-original"; reviewStatus: "human-reviewed-demo";
};

// Original demonstration questions written for this prototype, not copied from a question bank.
// Production questions must pass factual verification and editorial review before publication.
export const questions: Question[] = [
  { id:"q1", category:"Science", difficulty:"Easy", prompt:"A tiny seed is placed in a sealed glass jar with moist soil and light. What does the seed use first to begin growing?", options:["Stored energy inside the seed","Sugar from the soil","Oxygen made by leaves","Minerals from the glass"], answer:0, explanation:"A seed contains stored food that powers the earliest stage of germination. Roots and leaves develop later and take on more of the plant's energy needs.", provenance:"AI-generated-original", reviewStatus:"human-reviewed-demo" },
  { id:"q2", category:"World", difficulty:"Easy", prompt:"You travel east from a place just before midnight and cross the International Date Line. What unusual calendar change can happen?", options:["You may move to the next calendar day","Your clock stops for one hour","The year always changes","The season reverses"], answer:0, explanation:"Crossing the International Date Line eastward generally moves the calendar back one day; crossing westward generally moves it forward.", provenance:"AI-generated-original", reviewStatus:"human-reviewed-demo" },
  { id:"q3", category:"Technology", difficulty:"Medium", prompt:"Why do many data centers place servers in carefully cooled rooms?", options:["Cool air makes screens brighter","Electronic components produce heat while operating","Cold air increases internet speed directly","Servers stop using electricity when cool"], answer:1, explanation:"Processors and other electronic parts release heat. Keeping temperatures within safe ranges helps prevent failures and maintain reliable performance.", provenance:"AI-generated-original", reviewStatus:"human-reviewed-demo" },
  { id:"q4", category:"Nature", difficulty:"Medium", prompt:"A group of bees visits many flowers in one afternoon. What important service can they provide to plants?", options:["They turn sunlight into sugar","They move pollen between flowers","They create rain clouds","They spread roots underground"], answer:1, explanation:"When bees move between flowers, pollen can attach to their bodies and be transferred to another flower, helping many plants reproduce.", provenance:"AI-generated-original", reviewStatus:"human-reviewed-demo" },
  { id:"q5", category:"Culture", difficulty:"Easy", prompt:"Why might the same hand gesture mean different things in different countries?", options:["Gestures have universal meanings","Culture shapes how gestures are interpreted","Hands change shape by climate","Gestures are always formal language"], answer:1, explanation:"Gestures are part of culture. A movement that is friendly in one place may be confusing or impolite somewhere else.", provenance:"AI-generated-original", reviewStatus:"human-reviewed-demo" },
  { id:"q6", category:"Logic", difficulty:"Medium", prompt:"A library puts a blue sticker on every book about oceans. You find a book with a blue sticker. What can you safely conclude?", options:["It must be about oceans","It is the newest book","It may be about oceans, but the sticker rule alone doesn't prove it","It has no pictures"], answer:2, explanation:"The rule tells us ocean books have blue stickers, not that only ocean books do. This is the difference between a one-way rule and its converse.", provenance:"AI-generated-original", reviewStatus:"human-reviewed-demo" },
  { id:"q7", category:"Space", difficulty:"Easy", prompt:"Why do astronauts aboard the International Space Station appear to float?", options:["There is no gravity at all","They and the station are continuously falling around Earth together","The air pushes them upward","Their suits cancel their mass"], answer:1, explanation:"Earth's gravity is still strong at the station's altitude. The station and astronauts are in continuous free fall around Earth, creating the sensation of weightlessness.", provenance:"AI-generated-original", reviewStatus:"human-reviewed-demo" },
  { id:"q8", category:"Art", difficulty:"Medium", prompt:"An artist places a small bright object in a mostly dark painting. What visual effect is this most likely to create?", options:["A focal point that attracts attention","A perfectly flat perspective","A reduction in contrast","A change in the object's real size"], answer:0, explanation:"Strong contrast can guide the viewer's eye. A bright element against a dark field often becomes a natural focal point.", provenance:"AI-generated-original", reviewStatus:"human-reviewed-demo" }
];

export const categories = [
  {name:"Science", icon:"Atom", color:"violet", desc:"Big ideas, tiny discoveries"},
  {name:"World", icon:"Globe2", color:"blue", desc:"Places, people and history"},
  {name:"Technology", icon:"Cpu", color:"cyan", desc:"Ideas shaping tomorrow"},
  {name:"Nature", icon:"Leaf", color:"green", desc:"Life on our planet"},
  {name:"Logic", icon:"BrainCircuit", color:"pink", desc:"Patterns and clever thinking"},
  {name:"Culture", icon:"Palette", color:"amber", desc:"Art, language and traditions"},
  {name:"Space", icon:"Orbit", color:"indigo", desc:"Beyond our blue planet"},
  {name:"Art", icon:"Shapes", color:"rose", desc:"Creativity and design"}
];