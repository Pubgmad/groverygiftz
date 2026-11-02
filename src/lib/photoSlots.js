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

export function emptySlotIndexes(slots = []) {
  return slots.map((photo, index) => (photo?.url ? -1 : index)).filter((index) => index >= 0);
}

export function planPhotoUploads(slots = [], files = [], slotIndex = null, count) {
  const selected = Array.from(files || []).filter(Boolean);
  const aligned = alignPhotoSlots(slots, count);
  const empties = emptySlotIndexes(aligned);
  const used = filledPhotoCount(aligned);
  const max = aligned.length;
  if (Number.isInteger(slotIndex) && slotIndex >= 0) {
    if (!selected[0]) return { mode: 'empty', jobs: [], remaining: empties.length, used, max, blocked: false, files: selected };
    return { mode: 'replace', jobs: [{ index: slotIndex, file: selected[0] }], remaining: empties.length, used, max, blocked: false, files: selected };
  }
  if (selected.length === 0) return { mode: 'empty', jobs: [], remaining: empties.length, used, max, blocked: false, files: selected };
  if (empties.length === 0) {
    return { mode: 'full', jobs: [], remaining: 0, used, max, blocked: true, selectedCount: selected.length, files: selected };
  }
  if (selected.length > empties.length) {
    return { mode: 'excess', jobs: [], remaining: empties.length, used, max, blocked: true, selectedCount: selected.length, files: selected, empties };
  }
  return {
    mode: selected.length === 1 ? 'single' : 'batch',
    jobs: selected.map((file, index) => ({ index: empties[index], file })),
    remaining: empties.length - selected.length,
    used,
    max,
    blocked: false,
    selectedCount: selected.length,
    files: selected,
  };
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
