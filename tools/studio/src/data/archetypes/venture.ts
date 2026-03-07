import type { Archetype } from "./index";

export const VENTURE_ARCHETYPES: Archetype[] = [
  {
    id: "venture.mvp.v1",
    mode: "venture",
    title: "MVP Builder",
    emoji: "\u{1F680}",
    description: "Ship fast, minimal scope, validate core hypothesis",
    steps: [
      {
        id: "core_problem",
        title: "Core problem",
        questions: [
          {
            id: "problem_clarity",
            type: "select",
            prompt: "How well defined is the problem?",
            options: ["Crystal clear — I've experienced it myself", "I've talked to people with this problem", "I think the problem exists but haven't validated", "Exploring — not sure yet"],
          },
          {
            id: "existing_solutions",
            type: "select",
            prompt: "What do people use today?",
            options: ["Nothing — they suffer through it", "Spreadsheets / manual workarounds", "Competitor products (but they're lacking)", "They've built internal tools"],
          },
        ],
        required_outputs: ["problem_statement.v1"],
      },
      {
        id: "scope",
        title: "Smallest possible scope",
        questions: [
          {
            id: "one_feature",
            type: "short_text",
            prompt: "If you could only build ONE feature, what would it be?",
          },
          {
            id: "mvp_timeframe",
            type: "select",
            prompt: "Target time to first usable version?",
            options: ["1 week", "2 weeks", "1 month", "2-3 months"],
          },
        ],
        required_outputs: ["mvp_scope.v1"],
      },
      {
        id: "success",
        title: "Success metric",
        questions: [
          {
            id: "success_metric",
            type: "select",
            prompt: "What proves the MVP works?",
            options: ["Users come back (retention)", "Users pay (revenue)", "Users invite others (viral)", "Users complete the core action (activation)"],
          },
          {
            id: "target_users",
            type: "select",
            prompt: "How many users do you need to validate?",
            options: ["5-10 (deep feedback)", "20-50 (pattern validation)", "100+ (quantitative signal)", "1000+ (market validation)"],
          },
        ],
        required_outputs: ["success_criteria.v1"],
      },
      {
        id: "execution",
        title: "Execution plan",
        questions: [
          {
            id: "build_approach",
            type: "select",
            prompt: "How do you want to build?",
            options: ["Code it (full custom)", "No-code / low-code tools", "Hybrid (prototype fast, rebuild later)", "Landing page first, build if demand"],
          },
          {
            id: "distribution",
            type: "select",
            prompt: "How will first users find it?",
            options: ["Direct outreach to known contacts", "Community / forum posting", "Social media", "Paid ads", "Product Hunt / launch platform"],
          },
        ],
        required_outputs: ["execution_plan.v1"],
      },
    ],
    next_action_map: {
      core_problem: "scope",
      scope: "success",
      success: "execution",
      execution: "generate_spec",
    },
  },
  {
    id: "venture.validation.v1",
    mode: "venture",
    title: "Market Validation",
    emoji: "\u{1F50D}",
    description: "Customer discovery, experiments, landing tests",
    steps: [
      {
        id: "hypothesis",
        title: "Hypothesis",
        questions: [
          {
            id: "core_hypothesis",
            type: "short_text",
            prompt: "What is your core hypothesis? (X people will pay for Y because Z)",
          },
          {
            id: "riskiest_assumption",
            type: "select",
            prompt: "What is the riskiest assumption?",
            options: ["People have this problem", "People will pay to solve it", "We can build a solution", "We can reach these people", "We can do it better than alternatives"],
          },
        ],
        required_outputs: ["hypothesis_doc.v1"],
      },
      {
        id: "experiments",
        title: "Experiments",
        questions: [
          {
            id: "validation_method",
            type: "multiselect",
            prompt: "Which validation methods will you use?",
            options: ["Customer interviews", "Landing page + signup", "Concierge / manual MVP", "Smoke test (fake door)", "Survey"],
          },
          {
            id: "experiment_timeline",
            type: "select",
            prompt: "How long for each experiment round?",
            options: ["1 week", "2 weeks", "1 month"],
          },
        ],
        required_outputs: ["experiment_plan.v1"],
      },
      {
        id: "landing",
        title: "Landing plan",
        questions: [
          {
            id: "landing_goal",
            type: "select",
            prompt: "What should the landing page do?",
            options: ["Collect email signups", "Accept pre-orders / deposits", "Book discovery calls", "Gauge interest (click tracking)"],
          },
          {
            id: "traffic_source",
            type: "select",
            prompt: "Where will traffic come from?",
            options: ["Paid ads (Google / Meta)", "Organic social", "Community / forums", "Cold outreach", "Existing audience"],
          },
        ],
        required_outputs: ["landing_brief.v1"],
      },
      {
        id: "budget",
        title: "Budget and timeline",
        questions: [
          {
            id: "validation_budget",
            type: "select",
            prompt: "What is your validation budget?",
            options: ["$0 (bootstrapping)", "$100-500", "$500-2000", "$2000+"],
          },
          {
            id: "decision_point",
            type: "select",
            prompt: "When do you decide go / no-go?",
            options: ["After 10 conversations", "After 50 signups", "After first paying customer", "After 1 month of data"],
          },
        ],
        required_outputs: ["budget_plan.v1"],
      },
    ],
    next_action_map: {
      hypothesis: "experiments",
      experiments: "landing",
      landing: "budget",
      budget: "generate_spec",
    },
  },
  {
    id: "venture.gtm.v1",
    mode: "venture",
    title: "Go to Market",
    emoji: "\u{1F4E3}",
    description: "Positioning, channels, pricing, sales motion",
    steps: [
      {
        id: "positioning",
        title: "Positioning",
        questions: [
          {
            id: "positioning_statement",
            type: "short_text",
            prompt: "For [target], who [need], our product is [category] that [key benefit].",
          },
          {
            id: "competitive_angle",
            type: "select",
            prompt: "What is your competitive advantage?",
            options: ["Better price", "Better experience / design", "Unique feature / technology", "Niche focus / specialization", "Speed / convenience"],
          },
        ],
        required_outputs: ["positioning_doc.v1"],
      },
      {
        id: "channels",
        title: "Channels",
        questions: [
          {
            id: "primary_channel",
            type: "select",
            prompt: "What is your primary acquisition channel?",
            options: ["Content / SEO", "Paid ads", "Sales outreach", "Partnerships / referrals", "Product-led growth", "Community"],
          },
          {
            id: "secondary_channels",
            type: "multiselect",
            prompt: "Which secondary channels will you test?",
            options: ["Social media", "Email marketing", "Events / webinars", "Influencer / affiliate", "PR / press", "App store optimization"],
          },
        ],
        required_outputs: ["channel_plan.v1"],
      },
      {
        id: "pricing",
        title: "Pricing",
        questions: [
          {
            id: "pricing_model",
            type: "select",
            prompt: "What pricing model?",
            options: ["Free + paid tier (freemium)", "Subscription (monthly / annual)", "One-time purchase", "Usage-based", "Per-seat / per-user"],
          },
          {
            id: "price_point",
            type: "select",
            prompt: "What price range?",
            options: ["Under $10/mo", "$10-50/mo", "$50-200/mo", "$200+/mo", "Custom / enterprise"],
          },
        ],
        required_outputs: ["pricing_spec.v1"],
      },
      {
        id: "sales",
        title: "Sales motion",
        questions: [
          {
            id: "sales_model",
            type: "select",
            prompt: "How do customers buy?",
            options: ["Self-serve (signup and go)", "Sales-assisted (demo → close)", "Enterprise sales (multi-touch)", "Community-led (word of mouth)"],
          },
          {
            id: "launch_strategy",
            type: "select",
            prompt: "Launch approach?",
            options: ["Soft launch (invite only)", "Public launch (Product Hunt / social)", "Beta program (limited access)", "Direct outreach to first 10 customers"],
          },
        ],
        required_outputs: ["sales_plan.v1"],
      },
    ],
    next_action_map: {
      positioning: "channels",
      channels: "pricing",
      pricing: "sales",
      sales: "generate_spec",
    },
  },
  {
    id: "venture.fundraising.v1",
    mode: "venture",
    title: "Fundraising",
    emoji: "\u{1F4B0}",
    description: "Deck, narrative, metrics, investor pipeline",
    steps: [
      {
        id: "narrative",
        title: "Narrative",
        questions: [
          {
            id: "stage",
            type: "select",
            prompt: "What stage are you raising for?",
            options: ["Pre-seed (idea stage)", "Seed (early traction)", "Series A (product-market fit)", "Growth (scaling)"],
          },
          {
            id: "narrative_hook",
            type: "select",
            prompt: "What is your strongest narrative hook?",
            options: ["Massive market opportunity", "Strong traction / growth", "Unique technology / IP", "Experienced team", "Timing (market shift happening now)"],
          },
        ],
        required_outputs: ["narrative_doc.v1"],
      },
      {
        id: "metrics",
        title: "Metrics",
        questions: [
          {
            id: "key_metrics",
            type: "multiselect",
            prompt: "Which metrics can you present?",
            options: ["Revenue / MRR", "User growth", "Engagement / retention", "Unit economics (LTV/CAC)", "Waitlist / signups"],
          },
          {
            id: "ask_amount",
            type: "select",
            prompt: "How much are you raising?",
            options: ["Under $500K", "$500K - $1M", "$1M - $3M", "$3M - $10M", "$10M+"],
          },
        ],
        required_outputs: ["metrics_sheet.v1"],
      },
      {
        id: "deck",
        title: "Deck outline",
        questions: [
          {
            id: "deck_style",
            type: "select",
            prompt: "What deck style fits your story?",
            options: ["Data-driven (charts + metrics)", "Vision-driven (narrative + visuals)", "Demo-driven (product screenshots)", "Problem-driven (customer stories)"],
          },
          {
            id: "deck_length",
            type: "select",
            prompt: "Target deck length?",
            options: ["10 slides (concise)", "15 slides (standard)", "20+ slides (comprehensive appendix)"],
          },
        ],
        required_outputs: ["deck_outline.v1"],
      },
      {
        id: "pipeline",
        title: "Investor pipeline",
        questions: [
          {
            id: "investor_type",
            type: "multiselect",
            prompt: "Which investor types are you targeting?",
            options: ["Angel investors", "Micro VCs", "Institutional VCs", "Strategic / corporate", "Accelerators"],
          },
          {
            id: "pipeline_status",
            type: "select",
            prompt: "Where is your pipeline?",
            options: ["Starting from scratch", "Have some warm intros", "Active conversations", "Term sheets in hand"],
          },
        ],
        required_outputs: ["pipeline_tracker.v1"],
      },
    ],
    next_action_map: {
      narrative: "metrics",
      metrics: "deck",
      deck: "pipeline",
      pipeline: "generate_spec",
    },
  },
  {
    id: "venture.company.v1",
    mode: "venture",
    title: "Company Setup",
    emoji: "\u{1F3DB}\uFE0F",
    description: "Org structure, hiring plan, OKRs, operations",
    steps: [
      {
        id: "org",
        title: "Org structure",
        questions: [
          {
            id: "team_size",
            type: "select",
            prompt: "Current team size?",
            options: ["Solo founder", "2-3 co-founders", "Small team (4-10)", "Growing team (10-25)"],
          },
          {
            id: "org_model",
            type: "select",
            prompt: "How should the org be structured?",
            options: ["Flat (everyone does everything)", "Functional (eng, product, sales)", "Pod-based (cross-functional squads)", "Traditional hierarchy"],
          },
        ],
        required_outputs: ["org_chart.v1"],
      },
      {
        id: "hiring",
        title: "Hiring plan",
        questions: [
          {
            id: "first_hires",
            type: "multiselect",
            prompt: "What are your first hires?",
            options: ["Engineer", "Designer", "Sales / BD", "Marketing", "Operations", "Customer success"],
          },
          {
            id: "hiring_approach",
            type: "select",
            prompt: "How are you hiring?",
            options: ["Full-time employees", "Contractors / freelancers", "Mix of both", "Not hiring yet — founders only"],
          },
        ],
        required_outputs: ["hiring_plan.v1"],
      },
      {
        id: "okrs",
        title: "Goals and OKRs",
        questions: [
          {
            id: "time_horizon",
            type: "select",
            prompt: "What is your planning horizon?",
            options: ["This quarter (3 months)", "This half (6 months)", "This year", "18-month vision"],
          },
          {
            id: "top_objective",
            type: "select",
            prompt: "What is the #1 objective right now?",
            options: ["Launch the product", "Get to product-market fit", "Hit revenue milestone", "Raise funding", "Build the team"],
          },
        ],
        required_outputs: ["okr_doc.v1"],
      },
      {
        id: "ops",
        title: "Operations",
        questions: [
          {
            id: "tools",
            type: "multiselect",
            prompt: "Which tools do you already use?",
            options: ["Slack / Discord", "Linear / Jira", "Notion / Confluence", "Google Workspace", "GitHub / GitLab"],
          },
          {
            id: "cadence",
            type: "select",
            prompt: "What meeting cadence works for you?",
            options: ["Daily standups", "Weekly syncs", "Bi-weekly sprints", "Monthly reviews only", "Async-first (no regular meetings)"],
          },
        ],
        required_outputs: ["ops_playbook.v1"],
      },
    ],
    next_action_map: {
      org: "hiring",
      hiring: "okrs",
      okrs: "ops",
      ops: "generate_spec",
    },
  },
];
