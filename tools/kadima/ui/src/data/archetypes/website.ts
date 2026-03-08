import type { Archetype } from "./index";

export const WEBSITE_ARCHETYPES: Archetype[] = [
  {
    id: "website.brand.v1",
    mode: "website",
    title: "Brand / Marketing Site",
    emoji: "\u{1F3E2}",
    description: "Company presence, credibility, services showcase",
    steps: [
      {
        id: "audience",
        title: "Define your audience",
        questions: [
          {
            id: "target_audience",
            type: "select",
            prompt: "Who is this site mainly for?",
            options: ["Potential customers", "Investors / partners", "Job seekers", "Existing clients", "General public"],
          },
          {
            id: "visitor_goal",
            type: "select",
            prompt: "What should a visitor do in the first 10 seconds?",
            options: ["Understand what you do", "Feel trust and credibility", "Find a specific service", "Contact you"],
          },
        ],
        required_outputs: ["audience_profile.v1"],
      },
      {
        id: "content_strategy",
        title: "Content strategy",
        questions: [
          {
            id: "content_priority",
            type: "select",
            prompt: "What matters most on this site?",
            options: ["Services / offerings", "Case studies / portfolio", "Team and story", "Testimonials / social proof"],
          },
          {
            id: "update_frequency",
            type: "select",
            prompt: "How often will content change?",
            options: ["Rarely — set it and forget it", "Monthly updates", "Weekly blog or news", "Daily content"],
          },
        ],
        required_outputs: ["content_plan.v1"],
      },
      {
        id: "structure",
        title: "Site structure",
        questions: [
          {
            id: "page_count",
            type: "select",
            prompt: "How many pages do you need?",
            options: ["1-3 (minimal)", "4-7 (standard)", "8-15 (comprehensive)", "15+ (large site)"],
          },
          {
            id: "key_pages",
            type: "multiselect",
            prompt: "Which pages are essential?",
            options: ["Home", "About", "Services", "Portfolio", "Blog", "Contact", "Pricing", "FAQ"],
          },
        ],
        required_outputs: ["sitemap.v1"],
      },
      {
        id: "design_direction",
        title: "Design direction",
        questions: [
          {
            id: "design_feel",
            type: "select",
            prompt: "What feeling should the site convey?",
            options: ["Professional and clean", "Bold and creative", "Warm and approachable", "Minimal and elegant", "Energetic and modern"],
          },
          {
            id: "brand_assets",
            type: "select",
            prompt: "Do you have existing brand assets?",
            options: ["Full brand kit (logo, colors, fonts)", "Logo only", "Nothing yet — start fresh"],
          },
        ],
        required_outputs: ["design_brief.v1"],
      },
    ],
    next_action_map: {
      audience: "content_strategy",
      content_strategy: "structure",
      structure: "design_direction",
      design_direction: "generate_spec",
    },
  },
  {
    id: "website.leadgen.v1",
    mode: "website",
    title: "Lead Generation",
    emoji: "\u{1F4E9}",
    description: "Multi-page site focused on conversions, forms, CTAs",
    steps: [
      {
        id: "conversion_goal",
        title: "Define the conversion goal",
        questions: [
          {
            id: "primary_conversion",
            type: "select",
            prompt: "What is the main conversion action?",
            options: ["Fill out a contact form", "Book a demo / call", "Download a resource", "Sign up for trial", "Request a quote"],
          },
          {
            id: "lead_volume",
            type: "select",
            prompt: "What lead volume do you expect?",
            options: ["Low (quality over quantity)", "Medium (steady flow)", "High (scale with ads)"],
          },
        ],
        required_outputs: ["conversion_funnel.v1"],
      },
      {
        id: "pages",
        title: "Page strategy",
        questions: [
          {
            id: "landing_pages",
            type: "multiselect",
            prompt: "Which landing page types do you need?",
            options: ["Product / service page", "Pricing page", "Comparison page", "Case study page", "Resource / download page"],
          },
          {
            id: "trust_elements",
            type: "multiselect",
            prompt: "Which trust elements should appear?",
            options: ["Client logos", "Testimonials", "Stats / metrics", "Certifications", "Media mentions"],
          },
        ],
        required_outputs: ["page_strategy.v1"],
      },
      {
        id: "forms",
        title: "Forms and CTAs",
        questions: [
          {
            id: "form_length",
            type: "select",
            prompt: "How much info do you collect upfront?",
            options: ["Email only", "Name + email", "Name + email + company", "Detailed form (5+ fields)"],
          },
          {
            id: "cta_style",
            type: "select",
            prompt: "What CTA tone works best?",
            options: ["Direct (Get Started)", "Value-driven (See Your Results)", "Low friction (Learn More)", "Urgent (Limited Spots)"],
          },
        ],
        required_outputs: ["form_spec.v1"],
      },
      {
        id: "design",
        title: "Design direction",
        questions: [
          {
            id: "design_approach",
            type: "select",
            prompt: "What design approach fits your brand?",
            options: ["Corporate and trustworthy", "Startup and energetic", "SaaS clean and modern", "Bold and attention-grabbing"],
          },
          {
            id: "brand_assets",
            type: "select",
            prompt: "Do you have existing brand assets?",
            options: ["Full brand kit", "Logo only", "Start fresh"],
          },
        ],
        required_outputs: ["design_brief.v1"],
      },
    ],
    next_action_map: {
      conversion_goal: "pages",
      pages: "forms",
      forms: "design",
      design: "generate_spec",
    },
  },
  {
    id: "website.landing.v1",
    mode: "website",
    title: "Landing Page",
    emoji: "\u{1F3AF}",
    description: "Single page, one goal, one CTA",
    steps: [
      {
        id: "goal",
        title: "Define the goal",
        questions: [
          {
            id: "page_goal",
            type: "select",
            prompt: "What is this landing page for?",
            options: ["Collect leads / signups", "Sell a product", "Book appointments", "Download an app", "Event registration"],
          },
          {
            id: "urgency",
            type: "select",
            prompt: "Is there a time element?",
            options: ["No — evergreen page", "Limited time offer", "Launch / waitlist", "Event with a date"],
          },
        ],
        required_outputs: ["landing_goal.v1"],
      },
      {
        id: "offer",
        title: "The offer",
        questions: [
          {
            id: "headline_angle",
            type: "select",
            prompt: "What angle should the headline take?",
            options: ["Problem → solution", "Benefit-first", "Social proof lead", "Question hook", "Bold claim"],
          },
          {
            id: "proof_type",
            type: "multiselect",
            prompt: "What proof points should appear?",
            options: ["Customer testimonials", "Usage stats / numbers", "Demo video", "Before / after", "Logos / badges"],
          },
        ],
        required_outputs: ["offer_spec.v1"],
      },
      {
        id: "form",
        title: "Form and CTA",
        questions: [
          {
            id: "form_fields",
            type: "select",
            prompt: "How much info do you collect?",
            options: ["Email only", "Name + email", "Name + email + phone", "Custom fields"],
          },
          {
            id: "cta_text",
            type: "short_text",
            prompt: "What should the CTA button say?",
          },
        ],
        required_outputs: ["form_spec.v1"],
      },
      {
        id: "design",
        title: "Design direction",
        questions: [
          {
            id: "layout_style",
            type: "select",
            prompt: "What layout style?",
            options: ["Hero + sections scroll", "Full-screen hero only", "Split layout (text + visual)", "Video background"],
          },
          {
            id: "color_mood",
            type: "select",
            prompt: "What color mood?",
            options: ["Dark and bold", "Light and clean", "Vibrant and energetic", "Muted and professional"],
          },
        ],
        required_outputs: ["design_brief.v1"],
      },
    ],
    next_action_map: {
      goal: "offer",
      offer: "form",
      form: "design",
      design: "generate_spec",
    },
  },
  {
    id: "website.ecommerce.v1",
    mode: "website",
    title: "E-commerce",
    emoji: "\u{1F6D2}",
    description: "Product catalog, cart, checkout",
    steps: [
      {
        id: "catalog",
        title: "Catalog setup",
        questions: [
          {
            id: "catalog_size",
            type: "select",
            prompt: "How many products?",
            options: ["1-10 (small catalog)", "10-100 (medium)", "100-1000 (large)", "1000+ (enterprise)"],
          },
          {
            id: "product_type",
            type: "select",
            prompt: "What are you selling?",
            options: ["Physical products", "Digital products", "Services / subscriptions", "Mix of physical and digital"],
          },
        ],
        required_outputs: ["catalog_schema.v1"],
      },
      {
        id: "products",
        title: "Product details",
        questions: [
          {
            id: "product_complexity",
            type: "select",
            prompt: "How complex are product pages?",
            options: ["Simple (image + price + buy)", "Standard (variants, description, reviews)", "Rich (configurator, bundles, comparison)"],
          },
          {
            id: "product_features",
            type: "multiselect",
            prompt: "Which product features do you need?",
            options: ["Size / color variants", "Customer reviews", "Related products", "Wishlist", "Compare"],
          },
        ],
        required_outputs: ["product_spec.v1"],
      },
      {
        id: "payments",
        title: "Payments and checkout",
        questions: [
          {
            id: "payment_provider",
            type: "select",
            prompt: "Preferred payment provider?",
            options: ["Stripe", "PayPal", "Shopify Payments", "Square", "No preference"],
          },
          {
            id: "checkout_flow",
            type: "select",
            prompt: "Checkout experience?",
            options: ["Single page checkout", "Multi-step checkout", "Guest checkout only", "Account required"],
          },
        ],
        required_outputs: ["payment_spec.v1"],
      },
      {
        id: "design",
        title: "Design direction",
        questions: [
          {
            id: "store_style",
            type: "select",
            prompt: "What store style fits your brand?",
            options: ["Minimal and premium", "Colorful and playful", "Clean and functional", "Luxury and editorial"],
          },
          {
            id: "brand_assets",
            type: "select",
            prompt: "Do you have existing brand assets?",
            options: ["Full brand kit", "Logo only", "Start fresh"],
          },
        ],
        required_outputs: ["design_brief.v1"],
      },
    ],
    next_action_map: {
      catalog: "products",
      products: "payments",
      payments: "design",
      design: "generate_spec",
    },
  },
  {
    id: "website.content.v1",
    mode: "website",
    title: "Content / Blog",
    emoji: "\u{1F4DD}",
    description: "Articles, taxonomy, publishing workflow",
    steps: [
      {
        id: "taxonomy",
        title: "Content taxonomy",
        questions: [
          {
            id: "content_type",
            type: "select",
            prompt: "What kind of content?",
            options: ["Blog articles", "Documentation / guides", "News / magazine", "Knowledge base", "Mix of types"],
          },
          {
            id: "organization",
            type: "select",
            prompt: "How should content be organized?",
            options: ["Categories only", "Categories + tags", "Topic clusters", "Chronological (latest first)"],
          },
        ],
        required_outputs: ["taxonomy_spec.v1"],
      },
      {
        id: "authors",
        title: "Authors and workflow",
        questions: [
          {
            id: "author_count",
            type: "select",
            prompt: "How many people will publish content?",
            options: ["Just me", "2-5 authors", "Team with editor", "Open community submissions"],
          },
          {
            id: "workflow",
            type: "select",
            prompt: "What publishing workflow do you need?",
            options: ["Write and publish immediately", "Draft → review → publish", "Editorial calendar with scheduling", "Approval chain"],
          },
        ],
        required_outputs: ["workflow_spec.v1"],
      },
      {
        id: "publishing",
        title: "Publishing features",
        questions: [
          {
            id: "features",
            type: "multiselect",
            prompt: "Which features do you need?",
            options: ["Search", "Comments", "Newsletter signup", "RSS feed", "Social sharing", "Reading time"],
          },
          {
            id: "seo_priority",
            type: "select",
            prompt: "How important is SEO?",
            options: ["Critical — it's the main traffic source", "Important but not the only channel", "Nice to have", "Not a priority"],
          },
        ],
        required_outputs: ["feature_spec.v1"],
      },
      {
        id: "design",
        title: "Design direction",
        questions: [
          {
            id: "reading_experience",
            type: "select",
            prompt: "What reading experience?",
            options: ["Magazine layout (visual)", "Medium-style (clean reading)", "Documentation style (sidebar nav)", "Minimal (text-focused)"],
          },
          {
            id: "brand_assets",
            type: "select",
            prompt: "Do you have existing brand assets?",
            options: ["Full brand kit", "Logo only", "Start fresh"],
          },
        ],
        required_outputs: ["design_brief.v1"],
      },
    ],
    next_action_map: {
      taxonomy: "authors",
      authors: "publishing",
      publishing: "design",
      design: "generate_spec",
    },
  },
];
