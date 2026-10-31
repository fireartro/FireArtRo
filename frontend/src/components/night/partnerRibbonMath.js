export function ribbonLayout(width, height) {
  const cardWidth = Math.min(208, Math.max(98, width * .155), height * .48);
  return {
    cardWidth, cardHeight:cardWidth * .62, pitch:cardWidth + 16,
    radius:Math.max(90, width * .37),
    depth:Math.min(width * .34, height * .45),
    rise:height * .16,
    tilt:width < 600 ? .68 : .47,
  };
}

export function ribbonPeriod(count, layout) {
  return Math.max(Math.ceil(count / 2) * layout.pitch,
    layout.radius * Math.PI * 2 + layout.pitch * 8);
}

// Webly's helix frame, turned into two opposing diagonal ribbons. Each logo's
// vertices lie on the curved surface, including the part behind the sphere.
export function writeRibbonVertex(target, distance, row, lane, phase, layout) {
  const angle=distance / layout.radius;
  const sine=Math.sin(angle), cosine=Math.cos(angle);
  const tilt=lane===0 ? layout.tilt : -layout.tilt;
  let upX=-layout.rise * cosine;
  let upY=layout.radius * cosine * cosine + layout.depth * sine * sine;
  let upZ=layout.rise * sine;
  let length=Math.hypot(upX,upY,upZ);
  upX/=length;upY=upY/length+.6;upZ/=length;
  length=Math.hypot(upX,upY,upZ);
  const x=layout.radius*sine + row*upX/length;
  const y=layout.rise*angle + row*upY/length;
  target.x=x*Math.cos(tilt)-y*Math.sin(tilt);
  target.y=x*Math.sin(tilt)+y*Math.cos(tilt);
  target.z=layout.depth*cosine + row*upZ/length + (lane===0 ? 14 : -14)
    + Math.sin(angle*2+phase*.08)*layout.depth*.035;
}

export function ribbonDistance(index, count, travel, layout) {
  const period=ribbonPeriod(count,layout);
  const slot=Math.floor(index/2);
  const offset=index%2===0 ? travel : -travel+layout.pitch*.5;
  return ((slot*layout.pitch+offset+period/2)%period+period)%period-period/2;
}
