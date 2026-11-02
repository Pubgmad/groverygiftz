export function emptyPhotoSlots(count) {
  const size = Math.max(0, Number(count) || 0);
  return Array.from({ length: size }, () => null);
}

export function alignPhotoSlots(slots = [], count) {
  const size = Math.max(0, Number(count) || 0);
  return Array.from({ length: size }, (_, index) => slots[index] || null);
}

export function setPhotoSlot(slots = [], index, photo) {
  const next = slots.slice();
  if (index < 0) return next;
  while (next.length <= index) next.push(null);
  next[index] = photo || null;
  return next;
}

export function clearPhotoSlot(slots = [], index) {
  return setPhotoSlot(slots, index, null);
}

export function filledPhotos(slots = []) {
  return slots.filter((photo) => photo?.url);
}

export function filledPhotoCount(slots = []) {
  return filledPhotos(slots).length;
}

export function firstEmptyPhotoSlot(slots = []) {
  return slots.findIndex((photo) => !photo?.url);
}

export function removeListPhotoByUrl(photos = [], url) {
  const target = String(url || '');
  if (!target) return photos;
  let removed = false;
  return photos.filter((photo) => {
    if (removed) return true;
    if (photo?.url === target) {
      removed = true;
      return false;
    }
    return true;
  });
}
