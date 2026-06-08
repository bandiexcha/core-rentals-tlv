import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/lib/json-ld";

interface Crumb {
  name: string;
  path?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const schemaItems = items
    .filter((item) => item.path)
    .map((item) => ({ name: item.name, path: item.path! }));

  return (
    <>
      {schemaItems.length > 0 && <JsonLd data={breadcrumbSchema(schemaItems)} />}
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, i) => (
            <li key={item.name} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden className="text-sand-dark">/</span>}
              {item.path && i < items.length - 1 ? (
                <Link href={item.path} className="hover:text-mediterranean">
                  {item.name}
                </Link>
              ) : (
                <span className={i === items.length - 1 ? "text-navy" : undefined}>
                  {item.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
