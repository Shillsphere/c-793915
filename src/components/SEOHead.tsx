import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  canonical?: string;
}

export const SEOHead = ({
  title = "LinkDMS - AI-Powered LinkedIn Outreach Automation | Connect with 30+ Leads Daily",
  description = "Automate your LinkedIn outreach with LinkDMS. AI-powered platform that helps you connect with 30+ qualified leads daily, save 10+ hours per week, and grow your network efficiently.",
  keywords = "LinkedIn automation, LinkedIn outreach, lead generation, sales automation, B2B sales, LinkedIn marketing, prospect outreach, sales prospecting, business development, LinkedIn tools, sales CRM, lead management, automated messaging, LinkedIn campaigns, sales productivity",
  image = "https://linkdms.com/og-image.png",
  url = "https://linkdms.com",
  type = "website",
  canonical
}: SEOHeadProps) => {
  const fullUrl = canonical || url;
  
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={fullUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="LinkDMS" />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={fullUrl} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />
      
      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      
      {/* Structured Data for Rich Snippets */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": "LinkDMS",
          "description": description,
          "url": fullUrl,
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "59",
            "priceCurrency": "USD",
            "priceSpecification": {
              "@type": "UnitPriceSpecification",
              "price": "59",
              "priceCurrency": "USD",
              "billingIncrement": "P1M"
            }
          },
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "ratingCount": "127"
          },
          "featureList": [
            "AI-powered LinkedIn automation",
            "30+ daily lead connections",
            "Automated messaging campaigns",
            "Lead management dashboard",
            "Analytics and reporting",
            "CRM integration"
          ]
        })}
      </script>
    </Helmet>
  );
}; 