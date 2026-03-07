import type { Archetype } from "./index";

export const APPLICATION_ARCHETYPES: Archetype[] = [
  {
    id: "app.tracker.v1",
    mode: "application",
    title: "Tracker",
    emoji: "\u{1F4CA}",
    description: "Fitness, habits, logging, metrics tracking",
    steps: [
      {
        id: "outcome",
        title: "Define the core outcome",
        questions: [
          {
            id: "track_subject",
            type: "select",
            prompt: "What are users tracking?",
            options: ["Workouts / fitness", "Nutrition / meals", "Habits / routines", "Sleep / health", "Time / productivity", "Custom metrics"],
          },
          {
            id: "first_10_seconds",
            type: "select",
            prompt: "In the first 10 seconds, users should:",
            options: ["Start a session", "Log an entry", "See today's plan", "See progress"],
          },
        ],
        required_outputs: ["core_flow.v1", "tracking_schema.v1"],
      },
      {
        id: "data_model",
        title: "Data and cadence",
        questions: [
          {
            id: "tracking_cadence",
            type: "select",
            prompt: "How often do users log data?",
            options: ["Multiple times a day", "Once daily", "A few times per week", "Weekly"],
          },
          {
            id: "data_format",
            type: "select",
            prompt: "What does a single entry look like?",
            options: ["One number (weight, time, reps)", "A few fields (type + value + notes)", "Rich entry (multiple sections)", "Freeform journal"],
          },
        ],
        required_outputs: ["data_model.v1"],
      },
      {
        id: "visualization",
        title: "Progress and visualization",
        questions: [
          {
            id: "progress_view",
            type: "select",
            prompt: "How should users see their progress?",
            options: ["Charts and graphs", "Streak / calendar view", "Stats dashboard", "Before / after comparison"],
          },
          {
            id: "motivation",
            type: "select",
            prompt: "What keeps users coming back?",
            options: ["Streaks and consistency", "Goals and milestones", "Social comparison", "AI insights / suggestions"],
          },
        ],
        required_outputs: ["visualization_spec.v1"],
      },
      {
        id: "platform",
        title: "Platform and tech",
        questions: [
          {
            id: "platforms",
            type: "multiselect",
            prompt: "Where will this run?",
            options: ["Web app", "Mobile (iOS)", "Mobile (Android)", "Desktop"],
          },
          {
            id: "offline",
            type: "select",
            prompt: "Does it need to work offline?",
            options: ["Yes — full offline support", "Partial — cache recent data", "No — always online"],
          },
        ],
        required_outputs: ["platform_spec.v1"],
      },
    ],
    next_action_map: {
      outcome: "data_model",
      data_model: "visualization",
      visualization: "platform",
      platform: "generate_spec",
    },
  },
  {
    id: "app.saas.v1",
    mode: "application",
    title: "SaaS Dashboard",
    emoji: "\u{1F4BB}",
    description: "B2B admin panels, reports, roles, analytics",
    steps: [
      {
        id: "roles",
        title: "Users and roles",
        questions: [
          {
            id: "user_types",
            type: "multiselect",
            prompt: "Who uses this dashboard?",
            options: ["Admin / owner", "Team members", "Managers", "External clients", "Viewers (read-only)"],
          },
          {
            id: "access_model",
            type: "select",
            prompt: "How is access controlled?",
            options: ["Single role (everyone sees everything)", "Role-based (admin / member)", "Team-based (each team sees their data)", "Custom permissions per feature"],
          },
        ],
        required_outputs: ["role_matrix.v1"],
      },
      {
        id: "metrics",
        title: "Key metrics",
        questions: [
          {
            id: "primary_metric",
            type: "select",
            prompt: "What is the most important metric on the dashboard?",
            options: ["Revenue / MRR", "Usage / active users", "Tasks / tickets completed", "Performance / uptime", "Custom KPIs"],
          },
          {
            id: "data_freshness",
            type: "select",
            prompt: "How fresh does the data need to be?",
            options: ["Real-time", "Updated every few minutes", "Hourly", "Daily batch"],
          },
        ],
        required_outputs: ["metrics_spec.v1"],
      },
      {
        id: "features",
        title: "Core features",
        questions: [
          {
            id: "key_features",
            type: "multiselect",
            prompt: "Which features are essential at launch?",
            options: ["Data tables with filters", "Charts and visualizations", "Export (CSV/PDF)", "Notifications / alerts", "Settings / configuration", "Audit log"],
          },
          {
            id: "integrations",
            type: "select",
            prompt: "Does it need integrations at launch?",
            options: ["No — standalone", "API for external tools", "Slack / email notifications", "Import from existing tools"],
          },
        ],
        required_outputs: ["feature_spec.v1"],
      },
      {
        id: "platform",
        title: "Platform and tech",
        questions: [
          {
            id: "deployment",
            type: "select",
            prompt: "Where will this be hosted?",
            options: ["Cloud SaaS (multi-tenant)", "Self-hosted (on-premise)", "Hybrid", "No preference"],
          },
          {
            id: "auth_provider",
            type: "select",
            prompt: "Authentication method?",
            options: ["Email + password", "SSO (Google / Microsoft)", "Magic link", "Enterprise SSO (SAML)"],
          },
        ],
        required_outputs: ["platform_spec.v1"],
      },
    ],
    next_action_map: {
      roles: "metrics",
      metrics: "features",
      features: "platform",
      platform: "generate_spec",
    },
  },
  {
    id: "app.marketplace.v1",
    mode: "application",
    title: "Marketplace",
    emoji: "\u{1F3EA}",
    description: "Two-sided platform, listings, payments, trust",
    steps: [
      {
        id: "sides",
        title: "Define the two sides",
        questions: [
          {
            id: "seller_type",
            type: "select",
            prompt: "Who is selling / providing?",
            options: ["Individual sellers", "Small businesses", "Freelancers / professionals", "Companies / brands"],
          },
          {
            id: "buyer_type",
            type: "select",
            prompt: "Who is buying / consuming?",
            options: ["Individual consumers", "Businesses (B2B)", "Both individuals and businesses"],
          },
        ],
        required_outputs: ["sides_spec.v1"],
      },
      {
        id: "listings",
        title: "Listings and discovery",
        questions: [
          {
            id: "listing_type",
            type: "select",
            prompt: "What is being listed?",
            options: ["Physical products", "Digital products", "Services", "Rentals / bookings", "Jobs / gigs"],
          },
          {
            id: "discovery",
            type: "select",
            prompt: "How do buyers find what they need?",
            options: ["Search + filters", "Categories / browse", "Recommendations / matching", "Map-based / location"],
          },
        ],
        required_outputs: ["listing_spec.v1"],
      },
      {
        id: "trust",
        title: "Checkout and trust",
        questions: [
          {
            id: "payment_model",
            type: "select",
            prompt: "How does payment work?",
            options: ["Platform handles payments (escrow)", "Direct payment to seller", "Subscription model", "Free with premium features"],
          },
          {
            id: "trust_mechanism",
            type: "multiselect",
            prompt: "What builds trust between sides?",
            options: ["Reviews and ratings", "Verified profiles", "Dispute resolution", "Identity verification", "Guarantees / insurance"],
          },
        ],
        required_outputs: ["trust_spec.v1", "payment_spec.v1"],
      },
      {
        id: "platform",
        title: "Platform and tech",
        questions: [
          {
            id: "platforms",
            type: "multiselect",
            prompt: "Where will this run?",
            options: ["Web app", "Mobile (iOS)", "Mobile (Android)"],
          },
          {
            id: "scale_priority",
            type: "select",
            prompt: "What is the initial scale priority?",
            options: ["Start local / niche", "National from day one", "Global from day one"],
          },
        ],
        required_outputs: ["platform_spec.v1"],
      },
    ],
    next_action_map: {
      sides: "listings",
      listings: "trust",
      trust: "platform",
      platform: "generate_spec",
    },
  },
  {
    id: "app.social.v1",
    mode: "application",
    title: "Social",
    emoji: "\u{1F4AC}",
    description: "Profiles, feed, messaging, interactions",
    steps: [
      {
        id: "profiles",
        title: "User profiles",
        questions: [
          {
            id: "profile_depth",
            type: "select",
            prompt: "How rich are user profiles?",
            options: ["Minimal (avatar + name)", "Standard (bio + interests + avatar)", "Rich (portfolio / achievements / stats)", "Professional (resume / skills / experience)"],
          },
          {
            id: "identity",
            type: "select",
            prompt: "How do users identify themselves?",
            options: ["Real names", "Usernames / handles", "Anonymous / pseudonymous", "Organization-based"],
          },
        ],
        required_outputs: ["profile_spec.v1"],
      },
      {
        id: "feed",
        title: "Feed and content",
        questions: [
          {
            id: "content_type",
            type: "select",
            prompt: "What do users post?",
            options: ["Text posts", "Images / photos", "Short videos", "Long-form articles", "Mix of media types"],
          },
          {
            id: "feed_algorithm",
            type: "select",
            prompt: "How is the feed ordered?",
            options: ["Chronological (newest first)", "Algorithmic (relevance)", "Topic-based channels", "Following-only"],
          },
        ],
        required_outputs: ["feed_spec.v1"],
      },
      {
        id: "interactions",
        title: "Interactions",
        questions: [
          {
            id: "core_interactions",
            type: "multiselect",
            prompt: "Which interactions are core?",
            options: ["Like / react", "Comment / reply", "Share / repost", "Direct message", "Follow / subscribe"],
          },
          {
            id: "moderation",
            type: "select",
            prompt: "How is content moderated?",
            options: ["Community reporting", "Pre-moderation (approve before publish)", "AI auto-moderation", "Minimal / self-governed"],
          },
        ],
        required_outputs: ["interaction_spec.v1"],
      },
      {
        id: "platform",
        title: "Platform and tech",
        questions: [
          {
            id: "platforms",
            type: "multiselect",
            prompt: "Where will this run?",
            options: ["Web app", "Mobile (iOS)", "Mobile (Android)"],
          },
          {
            id: "real_time",
            type: "select",
            prompt: "How important is real-time?",
            options: ["Critical — live updates everywhere", "Important for messaging only", "Nice to have but not required", "Not needed"],
          },
        ],
        required_outputs: ["platform_spec.v1"],
      },
    ],
    next_action_map: {
      profiles: "feed",
      feed: "interactions",
      interactions: "platform",
      platform: "generate_spec",
    },
  },
  {
    id: "app.scheduling.v1",
    mode: "application",
    title: "Scheduling",
    emoji: "\u{1F4C5}",
    description: "Bookings, calendar, availability, reminders",
    steps: [
      {
        id: "resources",
        title: "What is being scheduled?",
        questions: [
          {
            id: "resource_type",
            type: "select",
            prompt: "What are users booking?",
            options: ["People (meetings / appointments)", "Rooms / spaces", "Equipment / assets", "Classes / events", "Services (haircut, repair, etc.)"],
          },
          {
            id: "booking_sides",
            type: "select",
            prompt: "Who books and who provides?",
            options: ["Customers book from providers", "Team members book internal resources", "Self-scheduling (personal calendar)", "Group scheduling (find mutual time)"],
          },
        ],
        required_outputs: ["resource_spec.v1"],
      },
      {
        id: "availability",
        title: "Availability rules",
        questions: [
          {
            id: "availability_model",
            type: "select",
            prompt: "How is availability managed?",
            options: ["Fixed hours (e.g., 9-5 Mon-Fri)", "Dynamic (providers set their own)", "Calendar sync (Google / Outlook)", "Capacity-based (N slots per hour)"],
          },
          {
            id: "booking_rules",
            type: "multiselect",
            prompt: "Which booking rules apply?",
            options: ["Minimum notice period", "Buffer between bookings", "Maximum advance booking", "Cancellation policy", "Recurring bookings"],
          },
        ],
        required_outputs: ["availability_spec.v1"],
      },
      {
        id: "time_zones",
        title: "Time zones and reminders",
        questions: [
          {
            id: "time_zone_handling",
            type: "select",
            prompt: "How important are time zones?",
            options: ["Single time zone only", "Auto-detect user's time zone", "Multi-timezone with conversions", "Not applicable"],
          },
          {
            id: "reminders",
            type: "multiselect",
            prompt: "How should users be reminded?",
            options: ["Email reminders", "SMS reminders", "Push notifications", "Calendar invite (.ics)", "No reminders needed"],
          },
        ],
        required_outputs: ["scheduling_spec.v1"],
      },
      {
        id: "platform",
        title: "Platform and tech",
        questions: [
          {
            id: "platforms",
            type: "multiselect",
            prompt: "Where will this run?",
            options: ["Web app", "Mobile (iOS)", "Mobile (Android)"],
          },
          {
            id: "payment",
            type: "select",
            prompt: "Is payment involved in bookings?",
            options: ["Yes — pay at booking", "Yes — pay after service", "Deposit only", "No payment — free scheduling"],
          },
        ],
        required_outputs: ["platform_spec.v1"],
      },
    ],
    next_action_map: {
      resources: "availability",
      availability: "time_zones",
      time_zones: "platform",
      platform: "generate_spec",
    },
  },
];
