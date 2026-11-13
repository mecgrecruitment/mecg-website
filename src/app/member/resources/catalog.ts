import "server-only";

export type ClubResource = {
  id: string;
  title: string;
  purpose: string;
  format: string;
  period: string;
  guidance: string;
  access: string;
  sourceKind: "drive" | "external";
  sources: readonly { title: string; url: string }[];
};

export const resourceGroups: readonly {
  id: string;
  title: string;
  description: string;
  resources: readonly ClubResource[];
}[] = [
  {
    id: "templates", title: "Consulting templates",
    description: "Preparation worksheets, communication examples and presentation starting points.",
    resources: [
      {
        access: "Google account with permission to the original required.", sourceKind: "drive",
        id: "behavioral-prep", title: "Behavioral interview preparation", format: "Google Sheets", period: "Term not specified",
        purpose: "Find the behavioral-preparation worksheets together instead of sorting through repeated file names.",
        guidance: "Two source files share the same title. Neither is designated as the master here; confirm the intended version before using it. Additional ‘Copy of’ files are omitted from this directory, not deleted from Drive. If using a worksheet, work in your own copy rather than changing a shared original.",
        sources: [
          { title: "MECG Behavioral Interview Preparation Template — source A", url: "https://docs.google.com/spreadsheets/d/1F8pfvlORvqMF4dQ2M2bZR5nM-x3XTyRQyK35TvBKjS4/edit" },
          { title: "MECG Behavioral Interview Preparation Template — source B", url: "https://docs.google.com/spreadsheets/d/1QiBFPxYhydO_2rwG4sU2D35clGDw7G25MQyS7XNjPa0/edit" },
        ],
      },
      {
        access: "Google account with permission to the original required.", sourceKind: "drive",
        id: "email-examples", title: "Email examples", format: "Google Docs", period: "Term not specified",
        purpose: "Locate the club’s sample-email document for reference when preparing a draft.",
        guidance: "Examples are references, not approval to send a message. Check the original and adapt names, facts and context before use.",
        sources: [{ title: "Sample Email Examples", url: "https://docs.google.com/document/d/1-mw3bepuwB0r0aTRIcriQM9bOkf78UgC9sJ0WcqGf9w/edit" }],
      },
      {
        access: "Google account with permission to the original required.", sourceKind: "drive",
        id: "interview-guide", title: "Consulting interview preparation guide", format: "Word document in Drive", period: "Term not specified",
        purpose: "Open the interview-preparation guide listed in Consulting Resources.",
        guidance: "The source is an Office document. Other copies exist; this listing does not establish which version is authoritative. Review the original before relying on its advice.",
        sources: [{ title: "Consulting Interview Prep Guide.docx", url: "https://docs.google.com/document/d/1YwfQpVnG1K-BRO2MZ9Qw2QyGtuuz3aC2/edit" }],
      },
      {
        access: "Google account with permission to the original required.", sourceKind: "drive",
        id: "slide-deck", title: "MECG presentation deck", format: "Google Slides", period: "Term not specified",
        purpose: "Find the MECG slide deck alongside other consulting preparation materials.",
        guidance: "This deck has not been verified as the current brand master or a blank template. Review it before reusing layouts or claims; keep your working edits separate from the original.",
        sources: [{ title: "MECG Slide Deck", url: "https://docs.google.com/presentation/d/1jNCyqjouseHusj99auq0v2p-gHue9OZTjP-hphXimKg/edit" }],
      },
    ],
  },
  {
    id: "workshops", title: "Workshop materials",
    description: "Club workshop decks, with the source’s semester label preserved where available.",
    resources: [
      {
        access: "Google account with permission to the original required.", sourceKind: "drive",
        id: "ai-workshop", title: "AI workshop", format: "Google Slides", period: "Fall 2026 · F26",
        purpose: "Return to the deck titled F26 MECG AI Workshop.",
        guidance: "The semester comes from the source title. This listing does not confirm an event date, completion of the workshop or the current accuracy of its contents.",
        sources: [{ title: "F26 MECG AI Workshop", url: "https://docs.google.com/presentation/d/1V8fdF1xvHPG3SyPSx1wlGqWnd-OcjkiNBVCTw4mLltM/edit" }],
      },
      {
        access: "Google account with permission to the original required.", sourceKind: "drive",
        id: "recruiting-workshop", title: "Recruiting workshop", format: "Google Slides", period: "Term not specified",
        purpose: "Find the Recruiting Workshop deck from the member-resource folder.",
        guidance: "The source title does not specify a semester. This is a learning resource, not a statement of MECG recruitment policy, deadlines or evaluation criteria.",
        sources: [{ title: "Recruiting Workshop", url: "https://docs.google.com/presentation/d/1aMT8khCrRtA-__Nveco3Fvzuk1XKTsimS1RUE8cSweY/edit" }],
      },
    ],
  },
{
  "id": "case-interview-practice",
  "title": "Case interview practice",
  "description": "Practice structuring problems and explaining your reasoning. Firm interview guidance does not define MECG recruitment policy.",
  "resources": [
    {
      "id": "official-1",
      "title": "McKinsey interview preparation",
      "purpose": "Practice sample business cases and prepare detailed personal-experience examples.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public guidance and sample cases; no purchase needed to read. This does not grant access to assessments or imply MECG selection policy.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "McKinsey interview preparation",
          "url": "https://www.mckinsey.com/careers/interviewing"
        }
      ]
    },
    {
      "id": "official-2",
      "title": "BCG case interview preparation",
      "purpose": "Practice structuring a business challenge, explaining calculations and clarifying assumptions.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public guidance. Linked OneDay simulation has a separate sign-up; participation was not tested.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "BCG case interview preparation",
          "url": "https://careers.bcg.com/global/en/case-interview-preparation"
        }
      ]
    },
    {
      "id": "official-3",
      "title": "Bain case interview preparation",
      "purpose": "Use Bain’s Coffee Shop Co. and FashionCo. practice cases and case-performance guidance.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public hub and linked sample cases. External prep products linked from it have separate terms; do not assume those products are entirely free.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "Bain case interview preparation",
          "url": "https://www.bain.com/careers/hiring-process/case-interview/"
        }
      ]
    }
  ]
},
{
  "id": "client-discovery-and-strategy",
  "title": "Client discovery and strategy",
  "description": "Understand the client problem, test assumptions and explore business models.",
  "resources": [
    {
      "id": "official-4",
      "title": "IDEO.org interview method",
      "purpose": "Prepare interview roles and broad-to-specific questions; distinguish observations from interpretation.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Method text publicly readable. Site also offers accounts; no account created. Obtain appropriate participant consent and protect confidential notes.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "IDEO.org interview method",
          "url": "https://www.designkit.org/methods/2.html"
        }
      ]
    },
    {
      "id": "official-5",
      "title": "Stanford Design Thinking Bootleg",
      "purpose": "Choose activities for empathizing, defining, ideating, prototyping and testing.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public page with downloadable PDF. Explicit CC BY-NC-SA 4.0 license: retain attribution and check noncommercial/share-alike restrictions before adapting or using in a paid engagement.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "Stanford Design Thinking Bootleg",
          "url": "https://dschool.stanford.edu/tools/design-thinking-bootleg"
        }
      ]
    },
    {
      "id": "official-6",
      "title": "Strategyzer Business Model Canvas",
      "purpose": "Map customers, value, delivery, costs and revenue on one page, then identify assumptions to investigate.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Official tool advertised as free to download and share with the team; guided playbooks are paid. Download flow and reuse terms should be checked before redistribution.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "Strategyzer Business Model Canvas",
          "url": "https://www.strategyzer.com/library/the-business-model-canvas"
        }
      ]
    }
  ]
},
{
  "id": "market-research-and-data",
  "title": "Market research and data",
  "description": "Find original data and check its definitions before drawing conclusions.",
  "resources": [
    {
      "id": "official-7",
      "title": "SBA market research and competitive analysis",
      "purpose": "Frame research around demand, market size, location, saturation, pricing and competitors.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public guidance with market-research and competitive-analysis sections. Old /business-guide/plan-your-business/market-research-competitive-analysis URL redirects here.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "SBA market research and competitive analysis",
          "url": "https://www.sba.gov/counseling/plan-your-business/"
        }
      ]
    },
    {
      "id": "official-8",
      "title": "Census Business Builder",
      "purpose": "Find demographic and business data by location and business type; compare areas and download reports.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public Census page and linked tool. Check data vintage, geography and definitions before using figures; interactive download workflow not exercised.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "Census Business Builder",
          "url": "https://www.census.gov/data/data-tools/cbb.html"
        }
      ]
    },
    {
      "id": "official-9",
      "title": "BLS data tools",
      "purpose": "Find official labor, wage, employment, inflation and productivity series for market context.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public tables and data tools; API also offered. Check units, seasonal adjustment, geography and reference period before comparing series.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "BLS data tools",
          "url": "https://www.bls.gov/data/"
        }
      ]
    },
    {
      "id": "official-10",
      "title": "World Bank indicators",
      "purpose": "Find country-level economic, population and sector indicators for international market context.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public indicator catalog. Coverage and methodology vary by indicator; check source notes, units, reference years and licensing for any selected dataset.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "World Bank indicators",
          "url": "https://data.worldbank.org/indicator"
        }
      ]
    }
  ]
},
{
  "id": "analysis-skills",
  "title": "Analysis skills",
  "description": "Develop spreadsheet and reporting skills with official learning material.",
  "resources": [
    {
      "id": "official-11",
      "title": "Microsoft Excel help and learning",
      "purpose": "Use official spreadsheet help and learning material while preparing a workbook or analysis.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public help content. Excel application access is separate and may require a license; no student entitlement assumed. Older video-training URL redirects here.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "Microsoft Excel help and learning",
          "url": "https://support.microsoft.com/en-us/excel/"
        }
      ]
    },
    {
      "id": "official-12",
      "title": "Microsoft Learn for Power BI",
      "purpose": "Learn data connection, Power Query preparation, modeling, reports and visualization through official learning paths.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public training catalog and learning pages. Sign-in may be used for progress; product sharing, instructor-led training and certification have separate access/cost requirements.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "Microsoft Learn for Power BI",
          "url": "https://learn.microsoft.com/en-us/training/powerplatform/power-bi"
        }
      ]
    }
  ]
},
{
  "id": "project-delivery",
  "title": "Project delivery",
  "description": "Plan the work, clarify decisions and review progress with your team.",
  "resources": [
    {
      "id": "official-13",
      "title": "Atlassian project plan template",
      "purpose": "Define project roles, scope, milestones and reference materials before delivery starts.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public instructions and example. Using the hosted template requires an Atlassian workspace/account and its plan limits; no club subscription assumed.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "Atlassian project plan template",
          "url": "https://www.atlassian.com/software/confluence/templates/project-plan"
        }
      ]
    },
    {
      "id": "official-14",
      "title": "Atlassian project poster",
      "purpose": "Keep the project problem, assumptions, supporting evidence and possible solutions in a living reference.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public play instructions; hosted templates/tools have separate account requirements. Can apply the planning questions in an approved existing workspace.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "Atlassian project poster",
          "url": "https://www.atlassian.com/team-playbook/plays/project-poster"
        }
      ]
    },
    {
      "id": "official-15",
      "title": "Atlassian DACI decision framework",
      "purpose": "Clarify the driver, approver, contributors and informed participants for a specific decision.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public instructions. Optional Confluence template requires its own account; this is a proposed method, not MECG approval authority.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "Atlassian DACI decision framework",
          "url": "https://www.atlassian.com/team-playbook/plays/daci"
        }
      ]
    },
    {
      "id": "official-16",
      "title": "Atlassian retrospective",
      "purpose": "Review what worked, identify improvements and assign follow-through actions after a project milestone.",
      "format": "Official resource",
      "period": "Reviewed November 12, 2026",
      "sourceKind": "external",
      "access": "Public play instructions. Optional Atlassian tools/templates have separate account terms; do not upload client information without authorization.",
      "guidance": "Read the linked provider’s current terms before downloading, adapting or using tools with client information. This resource does not imply a MECG partnership.",
      "sources": [
        {
          "title": "Atlassian retrospective",
          "url": "https://www.atlassian.com/team-playbook/plays/retrospective"
        }
      ]
    }
  ]
},
];
