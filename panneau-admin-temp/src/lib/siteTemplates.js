export const SITE_TEMPLATES = [
  {
    id: "signature",
    name: "Maison Signature",
    label: "Luxe intemporel",
    description: "Crème, or et élégance éditoriale",
    colors: { primary: "#C6A15B", deep: "#74520C", light: "#E8D3A7", cream: "#FBF6EF", soft: "#F6EFE6", ink: "#140E0A", inkSoft: "#2B2017", sand: "#E7DBD0" },
    gradient: "linear-gradient(135deg, #DFCA9B 0%, #C6A15B 50%, #9A7736 100%)",
    glow: "rgba(198, 161, 91, 0.28)",
    border: "rgba(198, 161, 91, 0.22)",
  },
  {
    id: "editorial",
    name: "Studio Éditorial",
    label: "Minimal chaleureux",
    description: "Ivoire, terracotta et caractère magazine",
    colors: { primary: "#B85C43", deep: "#743225", light: "#E7AE94", cream: "#FCF8F3", soft: "#F3E8DE", ink: "#211713", inkSoft: "#4A3028", sand: "#E2C9B9" },
    gradient: "linear-gradient(135deg, #E7AE94 0%, #B85C43 52%, #743225 100%)",
    glow: "rgba(184, 92, 67, 0.25)",
    border: "rgba(184, 92, 67, 0.22)",
  },
  {
    id: "glow",
    name: "Glow Pop",
    label: "Beauté contemporaine",
    description: "Prune, rose et énergie digitale",
    colors: { primary: "#D9467A", deep: "#76204A", light: "#F5A4C0", cream: "#FFF7FB", soft: "#F8EAF1", ink: "#21121C", inkSoft: "#482636", sand: "#E9C8D8" },
    gradient: "linear-gradient(135deg, #F5A4C0 0%, #D9467A 52%, #76204A 100%)",
    glow: "rgba(217, 70, 122, 0.25)",
    border: "rgba(217, 70, 122, 0.22)",
  },
];

export const getSiteTemplate = (id) =>
  SITE_TEMPLATES.find((template) => template.id === id) || SITE_TEMPLATES[0];
