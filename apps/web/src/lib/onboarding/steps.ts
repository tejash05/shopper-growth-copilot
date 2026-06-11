import type { DriveStep } from 'driver.js';

export interface TourStepDefinition {
  selector: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export const ONBOARDING_STEP_DEFINITIONS: TourStepDefinition[] = [
  {
    selector: '[data-tour="workspace-selector"]',
    title: 'Your brand workspace',
    description:
      'Each company works inside its own isolated workspace. Customers, orders, segments and campaigns stay scoped to the selected brand.',
    side: 'right',
    align: 'start',
  },
  {
    selector: '[data-tour="sidebar-command-center"]',
    title: 'Command Center',
    description:
      'Your real-time overview of shoppers, revenue, repeat purchase rate, campaign performance and AI growth opportunities.',
    side: 'right',
    align: 'start',
  },
  {
    selector: '[data-tour="ai-opportunity-card"]',
    title: 'AI growth opportunity',
    description:
      'The system detects high-impact shopper opportunities, such as dormant high-value customers, and helps you launch a campaign from here.',
    side: 'bottom',
    align: 'start',
  },
  {
    selector: '[data-tour="sidebar-shoppers"]',
    title: 'Shopper intelligence',
    description:
      'View customers, order history, RFM scores, churn risk, favorite categories and channel preferences.',
    side: 'right',
    align: 'start',
  },
  {
    selector: '[data-tour="sidebar-segments"]',
    title: 'Audience segments',
    description:
      'Create shopper audiences manually or through natural language, then reuse saved segments in campaigns.',
    side: 'right',
    align: 'start',
  },
  {
    selector: '[data-tour="sidebar-campaign-studio"]',
    title: 'AI Campaign Studio',
    description:
      'Give the AI agent a business goal. It recommends the audience, channel mix, offer, safety checks and personalised messages.',
    side: 'right',
    align: 'start',
  },
  {
    selector: '[data-tour="sidebar-campaigns"]',
    title: 'Campaign monitor',
    description:
      'Track sent, delivered, read, clicked and simulated campaign-attributed revenue from the callback-driven channel service.',
    side: 'right',
    align: 'start',
  },
  {
    selector: '[data-tour="sidebar-data-import"]',
    title: 'Bring your own data',
    description:
      "Upload customers and orders through CSV or JSON. The workspace dashboard and AI campaigns then run on that brand's own data.",
    side: 'right',
    align: 'start',
  },
  {
    selector: '[data-tour="new-ai-campaign"]',
    title: 'Launch your first AI campaign',
    description:
      'Start from a business goal and let the campaign agent guide you from planning to launch.',
    side: 'bottom',
    align: 'end',
  },
];

export function buildAvailableTourSteps(): DriveStep[] {
  if (typeof document === 'undefined') return [];

  return ONBOARDING_STEP_DEFINITIONS.filter((step) => {
    try {
      return Boolean(document.querySelector(step.selector));
    } catch {
      return false;
    }
  }).map((step) => ({
    element: step.selector,
    popover: {
      title: step.title,
      description: step.description,
      side: step.side,
      align: step.align,
    },
  }));
}
