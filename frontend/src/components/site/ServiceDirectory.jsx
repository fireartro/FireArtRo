import { Link } from "react-router-dom";
import { SERVICE_CATALOG, SERVICE_PAGE_DEFAULTS, SERVICE_PAGE_KEYS } from "@/data/serviceCatalog";
import useManagedContent from "@/hooks/useManagedContent";
import "@/styles/night-service-directory.css";

const services = SERVICE_CATALOG.filter((service) => !service.county);
const counties = SERVICE_CATALOG.filter((service) => service.county);

export default function ServiceDirectory() {
  const pages = useManagedContent("servicePages", SERVICE_PAGE_DEFAULTS);

  return (
    <nav className="fa-service-directory nr-shell" aria-label="Servicii și zone deservite">
      <div className="fa-service-directory__row">
        <h2 className="fa-kicker">Servicii</h2>
        <ul>
          {services.map((service) => (
            <li key={service.slug}>
              <Link to={service.path}>{pages?.[SERVICE_PAGE_KEYS[service.slug]]?.title || service.title}</Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="fa-service-directory__row">
        <h2 className="fa-kicker">Zone deservite</h2>
        <ul>
          {counties.map((service) => (
            <li key={service.slug}><Link to={service.path}>{service.county}</Link></li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
