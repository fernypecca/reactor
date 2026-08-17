/**
 * Starter posts for the composer. They are deliberately different in shape —
 * proof-led, pain-led, hype-led, question-led — because a simulator that only
 * ever sees one kind of copy tells you nothing about how it reacts.
 */
export const EXAMPLE_POSTS: string[] = [
  "We just shipped the fastest onboarding in SaaS — new users go from signup to first win in 4 minutes. 127 beta teams onboarded themselves this month, no calls, no setup. Try it free.",

  "Your support team answers the same 14 questions every week. We read your last 6 months of tickets and turn them into a help centre in an afternoon. 40% ticket deflection in the first month, or you don't pay.",

  "Most analytics tools tell you what happened. Ours tells you which experiment to run next, ranked by expected lift. Built it because I was tired of dashboards that end in a shrug.",

  "This is the most powerful AI growth platform ever built. Revolutionary agents that supercharge your entire funnel and unlock 10x results overnight. Join the waitlist.",

  "Churn is a pricing problem disguised as a product problem. We rebuilt our plans around usage instead of seats and net revenue retention went from 94% to 118% in two quarters. Full breakdown in the thread.",

  "Question for the founders here: how long does it actually take you to go from raw CSV to a chart someone will pay attention to? We got it to 90 seconds and I want to know if that number matters to anyone but me.",
];

/**
 * Pick a starter post, never the one already on screen. Callers must only
 * invoke this from an event handler — randomising during render would break
 * hydration.
 */
export function pickExample(current?: string, random: () => number = Math.random): string {
  const pool = EXAMPLE_POSTS.filter((p) => p !== current);
  const options = pool.length > 0 ? pool : EXAMPLE_POSTS;
  return options[Math.floor(random() * options.length) % options.length];
}
