import fs from "fs";
import path from "path";
import postcss from "postcss";

test("the actual partner stylesheet exposes a static list if the decorative scene fails", () => {
  const sheet = postcss.parse(fs.readFileSync(path.join(__dirname, "../../styles/night-home-film.css"), "utf8"));
  const style = document.createElement("style");
  style.textContent = sheet.nodes.filter(node => node.type === "rule" && node.selector.includes(".fa-partners")).map(String).join("\n");
  document.head.appendChild(style);
  const section = document.createElement("section");
  section.className = "fa-partners";
  section.dataset.gpu = "fallback";
  section.innerHTML = '<div class="fa-partners__sticky"><header class="fa-partners__copy"><h2>Partenerii FireArtRo</h2></header><div class="fa-partners__names"><span>Partner one</span></div></div>';
  document.body.appendChild(section);
  try {
    const names = getComputedStyle(section.querySelector(".fa-partners__names"));
    expect(names.clipPath).toBe("none");
    expect(names.overflow).toBe("visible");
    expect(names.height).toBe("auto");
  } finally { section.remove(); style.remove(); }
});
