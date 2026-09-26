const even = value => 2 * Math.floor(value / 2);

export function getDisplayDimensions(stream) {
  const rotation = stream.side_data_list?.find(item => Number.isFinite(item.rotation))?.rotation || 0;
  const quarterTurn = Math.abs(Math.round(rotation / 90)) % 2 === 1;
  return quarterTurn ? { width: stream.height, height: stream.width } : { width: stream.width, height: stream.height };
}

export function getPortraitFocusCrop(info, focus) {
  const baseWidth = even(Math.min(info.width, info.height * 9 / 16));
  const baseHeight = even(Math.min(info.height, info.width * 16 / 9));
  const width = even(baseWidth / focus.zoom);
  const height = even(baseHeight / focus.zoom);
  const top = Math.round((baseHeight - height) * focus.y);
  return { baseWidth, baseHeight, width, height, top };
}
