import type { Audience, FollowerProfile, Tone } from "./types";

type RawFollower = {
  name: string;
  handle: string;
  bio: string;
  interests: string[];
  tone: Tone;
  engagement: FollowerProfile["engagement"];
  objection: string;
};

type RawSegment = { id: string; label: string; followers: RawFollower[] };

type RawAudience = {
  id: string;
  name: string;
  description: string;
  segments: RawSegment[];
};

const raw: RawAudience[] = [
  {
    id: "indie-hackers",
    name: "Indie Hackers",
    description:
      "Solo builders and bootstrappers. Skeptical of hype, allergic to agency-speak, obsessed with revenue numbers and margins.",
    segments: [
      {
        id: "builder",
        label: "Builder",
        followers: [
          { name: "Mara Delgado", handle: "@marabuilds", bio: "Bootstrapped to $10k MRR. Shipping in public.", interests: ["bootstrapping", "pricing", "indie web"], tone: "numbers", engagement: "thread", objection: "Show the revenue, not the roadmap." },
          { name: "Ivan Petrov", handle: "@ivanships", bio: "Solopreneur. 6 products, 2 alive.", interests: ["micro-saas", "launch", "side projects"], tone: "questioner", engagement: "short", objection: "How many customers actually use this?" },
          { name: "Priya Nair", handle: "@priyacodes", bio: "Developer who sells. No VC, no drama.", interests: ["dev tools", "bootstrapping", "indie web"], tone: "skeptic", engagement: "short", objection: "Feels like another wrapper around the same thing." },
          { name: "Tom Becker", handle: "@tbecker", bio: "Two exits. Now building in public again.", interests: ["pricing", "growing revenue", "b2b"], tone: "numbers", engagement: "thread", objection: "Whats the retention number?" },
          { name: "Ana Sofia Cruz", handle: "@anadaily", bio: "Daily build logs. MRR visible live.", interests: ["indie web", "launch", "no-code"], tone: "cheerleader", engagement: "short", objection: "Love it, but who is this for exactly?" },
          { name: "Lars Johansson", handle: "@larsgrows", bio: "Bootstrapped marketing tool. 40h/week.", interests: ["marketing", "acquisition", "revenue"], tone: "questioner", engagement: "thread", objection: "Whats the CAC you are claiming?" },
          { name: "Grace Li", handle: "@gracebuilds", bio: "Ex-FAANG, now solo. Build in public.", interests: ["micro-saas", "indie web", "ai"], tone: "skeptic", engagement: "short", objection: "Another AI tool. Whats different?" },
          { name: "Diego Fuentes", handle: "@diegof", bio: "Night builds, day job. Shipping weekly.", interests: ["side projects", "launch", "no-code"], tone: "cheerleader", engagement: "short", objection: "How fast can I try it for free?" },
          { name: "Karl Chen", handle: "@karlc", bio: "Micro-SaaS founder. Indie hacker since 2019.", interests: ["bootstrapping", "growth", "metrics"], tone: "numbers", engagement: "thread", objection: "What's your weekly active user count?" },
          { name: "Sofia Ramos", handle: "@sofiar", bio: "Builder in public. Daily dev logs.", interests: ["indie web", "launch", "community"], tone: "cheerleader", engagement: "short", objection: "Who is the target user?" },
        ],
      },
      {
        id: "operator",
        label: "Operator",
        followers: [
          { name: "Nina Kowalski", handle: "@ninak", bio: "Runs a 3-person agency. Client work by day, SaaS by night.", interests: ["agencies", "revenue", "b2b"], tone: "numbers", engagement: "short", objection: "Does this save my team hours or is it a toy?" },
          { name: "Sam Okafor", handle: "@samsells", bio: "Sales turned builder. Hates fluff.", interests: ["outbound", "revenue", "b2b"], tone: "skeptic", engagement: "short", objection: "No numbers, no deal." },
          { name: "Julia Meyer", handle: "@juliam", bio: "Content operator. Turned one blog into 40k/mo.", interests: ["content", "seo", "marketing"], tone: "questioner", engagement: "thread", objection: "What makes you different from free tools?" },
          { name: "Kenji Tanaka", handle: "@kenjispreadsheet", bio: "Excel as a religion. Ops guy.", interests: ["workflow", "automation", "b2b"], tone: "questioner", engagement: "thread", objection: "Where does the data actually live?" },
          { name: "Rosa Del Vecchio", handle: "@rosadv", bio: "Freelancer growth marketer. Owns every deliverable.", interests: ["marketing", "freelance", "tooling"], tone: "numbers", engagement: "short", objection: "Show me time saved, not features listed." },
          { name: "Milan Novak", handle: "@milanops", bio: "Head of growth at a 20-person SaaS.", interests: ["growth", "experimentation", "revenue"], tone: "skeptic", engagement: "thread", objection: "Been burned by 'AI growth' pitches. Prove it." },
          { name: "Eva Schmidt", handle: "@eva", bio: "Agency owner scaling to 5 clients.", interests: ["automation", "b2b", "revenue"], tone: "numbers", engagement: "short", objection: "Does it integrate with HubSpot?" },
          { name: "Liam O'Connor", handle: "@liamoc", bio: "Founder-led sales. Hates cold outreach.", interests: ["outbound", "growth", "b2b"], tone: "skeptic", engagement: "short", objection: "Is it a viable pipeline tool?" },
        ],
      },
      {
        id: "lurker",
        label: "Lurker",
        followers: [
          { name: "Sofia Marchetti", handle: "@sofiareads", bio: "Reading everything, shipping nothing.", interests: ["indie web", "ai", "launch"], tone: "cheerleader", engagement: "short", objection: "Nice! Is there a free tier?" },
          { name: "Alex Chen", handle: "@alexc", bio: "Lurker. Decide in the comments.", interests: ["micro-saas", "pricing", "indie web"], tone: "questioner", engagement: "meme", objection: "Pricing link or it didn't happen." },
          { name: "Hannah Weber", handle: "@hannahw", bio: "PM by day, lurker by night.", interests: ["product", "b2b", "ai"], tone: "skeptic", engagement: "short", objection: "What problem does this solve that a Notion doc doesn't?" },
          { name: "Omar Haddad", handle: "@omarh", bio: "Here for the memes and the numbers.", interests: ["launch", "side projects", "ai"], tone: "cheerleader", engagement: "meme", objection: "Link?" },
          { name: "Lena Fischer", handle: "@lenaf", bio: "Collecting tool links. Using none.", interests: ["no-code", "indie web", "ai"], tone: "questioner", engagement: "short", objection: "Is it a one-time payment?" },
          { name: "Raj Mehta", handle: "@rajm", bio: "Investor lurker. Reads everything.", interests: ["b2b", "growth", "revenue"], tone: "numbers", engagement: "thread", objection: "Whats the unit economics?" },
          { name: "Tina Wang", handle: "@tinaw", bio: "Stealth startup. Reading before acting.", interests: ["ai", "no-code", "indie web"], tone: "cheerleader", engagement: "meme", objection: "Free tier or nothing?" },
          { name: "Marcus Lee", handle: "@marcusl", bio: "Quiet observer. Learns in public.", interests: ["product", "b2b", "ai"], tone: "questioner", engagement: "short", objection: "Show me the ROI." },
        ],
      },
    ],
  },
  {
    id: "saas-founders",
    name: "SaaS Founders",
    description:
      "Growth-first operators and founders. Compare against existing tools, care about onboarding and churn, reward concrete results.",
    segments: [
      {
        id: "founder",
        label: "Founder",
        followers: [
          { name: "Elena Vasquez", handle: "@elenafounder", bio: "CEO @ a 15-person SaaS. Revenue-focused.", interests: ["churn", "b2b", "growth"], tone: "numbers", engagement: "thread", objection: "How does this cut churn, not just engagement?" },
          { name: "David Kim", handle: "@davidsaas", bio: "2x founder. Currently on revenue #3.", interests: ["pricing", "revenue", "b2b"], tone: "skeptic", engagement: "short", objection: "Every tool promises 'growth'. Yours?" },
          { name: "Amara Osei", handle: "@amaraosei", bio: "Founder of an onboarding tool.", interests: ["onboarding", "activation", "saas"], tone: "questioner", engagement: "thread", objection: "Whats the activation metric you target?" },
          { name: "Viktor Barta", handle: "@viktorb", bio: "Solopreneur, $40k ARR, no team.", interests: ["micro-saas", "pricing", "growth"], tone: "numbers", engagement: "short", objection: "What does it cost per month, really?" },
          { name: "Clara Moreau", handle: "@claram", bio: "Founder. Exited once, bootstrapping now.", interests: ["b2b", "churn", "saas"], tone: "skeptic", engagement: "thread", objection: "Not impressed by logos. Show me the math." },
          { name: "Felix Braun", handle: "@felixb", bio: "Co-founder, growth team of two.", interests: ["growth", "experimentation", "saas"], tone: "questioner", engagement: "short", objection: "Is this a workflow change or a drop-in?" },
          { name: "Stefan Kowalski", handle: "@stefank", bio: "Serial SaaS founder. 2 exits in 3 years.", interests: ["growth", "b2b", "saas"], tone: "numbers", engagement: "short", objection: "What's the net margin after churn?" },
          { name: "Ines Martinez", handle: "@inesm", bio: "Founder of a remote-first tool.", interests: ["saas", "growth", "team"], tone: "questioner", engagement: "short", objection: "Does it support distributed teams?" },
          { name: "Arjun Mehta", handle: "@arjunm", bio: "Bootstrapped founder. Pricing-first mindset.", interests: ["pricing", "growth", "micro-saas"], tone: "numbers", engagement: "thread", objection: "Whats the ARPU vs churn tradeoff?" },
          { name: "Petra Novak", handle: "@petran", bio: "Co-founder, ex-consultant. Data-driven.", interests: ["b2b", "saas", "activation"], tone: "questioner", engagement: "short", objection: "What does onboarding look like in practice?" },
        ],
      },
      {
        id: "growth",
        label: "Growth",
        followers: [
          { name: "Yuki Sato", handle: "@yukigrowth", bio: "Growth lead. Runs 40 experiments a quarter.", interests: ["experimentation", "growth", "revenue"], tone: "numbers", engagement: "thread", objection: "Show me the experiment or it's a claim." },
          { name: "Isabelle Fontaine", handle: "@isagrowth", bio: "Demand gen. Owns the pipeline.", interests: ["demand gen", "ads", "growth"], tone: "skeptic", engagement: "short", objection: "Where are the case studies with numbers?" },
          { name: "Marco Rizzo", handle: "@marcor", bio: "Growth marketer. Tests everything twice.", interests: ["a-b testing", "growth", "b2b"], tone: "questioner", engagement: "thread", objection: "Whats the sample size behind that claim?" },
          { name: "Aisha Rahman", handle: "@aishar", bio: "Lifecycle marketer. Onboarding obsessed.", interests: ["onboarding", "activation", "saas"], tone: "cheerleader", engagement: "short", objection: "Love the concept. How fast to first value?" },
          { name: "Petr Svoboda", handle: "@petrs", bio: "Performance marketer. LTV first.", interests: ["ltv", "ads", "revenue"], tone: "numbers", engagement: "short", objection: "Whats the LTV/CAC assumption here?" },
          { name: " Nina Karlsson", handle: "@ninali", bio: "Growth lead. 30 experiments a quarter.", interests: ["experimentation", "growth", "revenue"], tone: "numbers", engagement: "thread", objection: "Whats the conversion rate?" },
          { name: "Omar Al-Zahra", handle: "@omaraz", bio: "Growth operator. A/B tests everything.", interests: ["a-b testing", "growth", "b2b"], tone: "questioner", engagement: "short", objection: "Whats the p-value?" },
        ],
      },
      {
        id: "customer",
        label: "Customer",
        followers: [
          { name: "Gwen Paterson", handle: "@gwenp", bio: "Customer of every SaaS. Reviews honestly.", interests: ["saas", "pricing", "support"], tone: "skeptic", engagement: "short", objection: "Support is the real product. What's yours?" },
          { name: "Tomas Hernandez", handle: "@tomash", bio: "Buys software for a 60-person team.", interests: ["b2b", "security", "pricing"], tone: "questioner", engagement: "thread", objection: "Does this pass procurement?" },
          { name: "Freya Olsen", handle: "@freyao", bio: "Ops lead. Cancels the tools that lie.", interests: ["workflow", "b2b", "automation"], tone: "skeptic", engagement: "short", objection: "What breaks when this scales to 100 users?" },
          { name: "Hiro Yamamoto", handle: "@hiroy", bio: "VP of Product. Reads G2 before anything.", interests: ["product", "b2b", "saas"], tone: "questioner", engagement: "thread", objection: "Whats the migration cost from my current stack?" },
          { name: "Maya Patel", handle: "@mayap", bio: "Head of customer success.", interests: ["cs", "churn", "onboarding"], tone: "cheerleader", engagement: "short", objection: "If it helps onboarding, I'm listening." },
          { name: "Walter White", handle: "@walterw", bio: "Enterprise customer. Strict on procurement.", interests: ["saas", "security", "pricing"], tone: "skeptic", engagement: "short", objection: "Does it pass security review?" },
          { name: "Priya Sharma", handle: "@priys", bio: "Customer success manager.", interests: ["cs", "churn", "onboarding"], tone: "cheerleader", engagement: "short", objection: "Does it integrate with Salesforce?" },
        ],
      },
    ],
  },
  {
    id: "ai-enthusiasts",
    name: "AI Enthusiasts",
    description:
      "Early adopters and builders. Technical, reward novel demos, punish vague claims. Density of signal matters.",
    segments: [
      {
        id: "builder",
        label: "Builder",
        followers: [
          { name: "Jonas Lind", handle: "@jonasbuilds", bio: "Fine-tunes models for fun. Ships weekly.", interests: ["llms", "ai tools", "open source"], tone: "skeptic", engagement: "thread", objection: "Whats the model stack and cost per call?" },
          { name: "Kelly Zhang", handle: "@kellyzh", bio: "AI engineer. Tries every tool once.", interests: ["llms", "automation", "ai tools"], tone: "numbers", engagement: "short", objection: "Latency and price, please." },
          { name: "Bram van Dijk", handle: "@bramvd", bio: "Builder of AI side projects.", interests: ["ai tools", "micro-saas", "llms"], tone: "cheerleader", engagement: "short", objection: "Is there an API?" },
          { name: "Nadia Belkacem", handle: "@nadiaai", bio: "Research engineer. Reads papers, tests tools.", interests: ["llms", "agents", "ai tools"], tone: "questioner", engagement: "thread", objection: "What problem does this solve that existing agents don't?" },
          { name: "Ryan Cole", handle: "@ryancole", bio: "Prompt tinkerer. Built 3 AI apps.", interests: ["ai tools", "prompting", "micro-saas"], tone: "skeptic", engagement: "short", objection: "Demo or it didn't happen." },
          { name: "Tina Cole", handle: "@tinac", bio: "AI generalist. Experiments daily.", interests: ["ai tools", "llms", "automation"], tone: "cheerleader", engagement: "short", objection: "What's the next big thing?" },
          { name: "Mikko Vainio", handle: "@mikkov", bio: "Research engineer. Evaluates model performance.", interests: ["llms", "agents", "open source"], tone: "numbers", engagement: "thread", objection: "How do you benchmark?" },
          { name: "Ava Lindqvist", handle: "@aval", bio: "Prompt engineer. Ships agent demos.", interests: ["agents", "prompting", "llms"], tone: "skeptic", engagement: "thread", objection: "Show the failure modes, not just the demo." },
          { name: "Noah Bergström", handle: "@noahb", bio: "Hackathon winner. Builds in 48h.", interests: ["ai tools", "micro-saas", "launch"], tone: "cheerleader", engagement: "short", objection: "Can I fork a template to start?" },
          { name: "Elif Demir", handle: "@elifd", bio: "ML engineer. Reads evals before launches.", interests: ["llms", "open source", "agents"], tone: "numbers", engagement: "thread", objection: "What eval set backs this up?" },
        ],
      },
      {
        id: "early",
        label: "Early Adopter",
        followers: [
          { name: "Sofia Andersson", handle: "@sofiaearly", bio: "Tries every launch on day one.", interests: ["ai tools", "launch", "automation"], tone: "cheerleader", engagement: "meme", objection: "How do I get in early?" },
          { name: "Lucas Moreira", handle: "@lucasmo", bio: "Product manager for AI features.", interests: ["agents", "ai tools", "workflow"], tone: "questioner", engagement: "short", objection: "Where does the human stay in the loop?" },
          { name: "Chloe Dubois", handle: "@chloed", bio: "Content creator covering AI weeklies.", interests: ["ai tools", "llms", "automation"], tone: "cheerleader", engagement: "thread", objection: "What's the one demo I should film?" },
          { name: "Oskar Nielsen", handle: "@oskarn", bio: "Beta tester for everything.", interests: ["ai tools", "launch", "agents"], tone: "skeptic", engagement: "short", objection: "Another agent framework? Show the edge case." },
          { name: "Anouk Vermeulen", handle: "@anoukv", bio: "Designer using AI daily.", interests: ["ai tools", "automation", "workflow"], tone: "cheerleader", engagement: "short", objection: "Is it beautiful to use, not just powerful?" },
          { name: "Mateo Ruiz", handle: "@materu", bio: "Early adopter. Tests every new tool.", interests: ["ai tools", "launch", "automation"], tone: "questioner", engagement: "short", objection: "Whats the learning curve?" },
          { name: "Nina Berg", handle: "@ninaeb", bio: "Tech explorer. Day-one buyer.", interests: ["ai tools", "automation", "workflow"], tone: "numbers", engagement: "meme", objection: "Is it worth the price?" },
        ],
      },
      {
        id: "observer",
        label: "Observer",
        followers: [
          { name: "Theo Richardson", handle: "@theor", bio: "Watches the space, invests selectively.", interests: ["agents", "ai tools", "b2b"], tone: "numbers", engagement: "thread", objection: "Whats the defensibility beyond the model?" },
          { name: "Marta Ibanez", handle: "@martai", bio: "Tech journalist. Senses hype instantly.", interests: ["ai tools", "llms", "launch"], tone: "skeptic", engagement: "thread", objection: "Vague claims die in the comments." },
          { name: "Danilo Castro", handle: "@daniloc", bio: "Data scientist. Skips slides, reads code.", interests: ["llms", "open source", "agents"], tone: "skeptic", engagement: "short", objection: "Open the source or show the eval." },
          { name: "Yara Khalil", handle: "@yarak", bio: "Startup advisor for AI companies.", interests: ["agents", "b2b", "ai tools"], tone: "questioner", engagement: "thread", objection: "Who is the buyer and what's the budget?" },
          { name: "Ethan Walsh", handle: "@ethanw", bio: "Investor scout. Speed-reads launches.", interests: ["ai tools", "launch", "agents"], tone: "numbers", engagement: "short", objection: "Whats the traction after week one?" },
          { name: "Viktoria Voss", handle: "@viktoriav", bio: "Advisor for AI security.", interests: ["agents", "b2b", "ai tools"], tone: "numbers", engagement: "short", objection: "What's the threat model?" },
          { name: "Silas Webb", handle: "@silasw", bio: "Independent researcher. Watches the space.", interests: ["ai tools", "llms", "b2b"], tone: "questioner", engagement: "thread", objection: "Show the eval results." },
        ],
      },
    ],
  },
];

export function expandAudience(def: Audience): Audience {
  return {
    ...def,
    profiles: def.profiles.map((p) => ({ ...p, interests: [...p.interests] })),
  };
}

export const AUDIENCES: Audience[] = raw.map((r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  segments: r.segments.map((s) => ({ id: s.id, label: s.label })),
  profiles: r.segments.flatMap((s) =>
    s.followers.map((f, i) => ({
      id: `${r.id}-${s.id}-${i}`,
      name: f.name,
      handle: f.handle,
      bio: f.bio,
      interests: f.interests,
      tone: f.tone,
      engagement: f.engagement,
      objection: f.objection,
      segment: s.id,
    })),
  ),
}));