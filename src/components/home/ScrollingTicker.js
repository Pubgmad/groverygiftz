export default function ScrollingTicker({ messages = [] }) {
  const line = messages.length > 0 ? messages.join('  |  ') : 'Tamil Nadu Free Delivery  |  Personalized Gifts  |  Pan India Delivery';
  const repeated = Array(4).fill(line).join('     ');
  return (
    <div className="py-2.5 overflow-hidden" style={{ background: 'linear-gradient(90deg, #F47920 0%, #D96212 35%, #2456D8 65%, #1B44B8 100%)' }}>
      <div className="announcement-scroll whitespace-nowrap flex">
        <span className="text-sm font-semibold text-white tracking-wide">{repeated}</span>
        <span className="text-sm font-semibold text-white tracking-wide ml-8">{repeated}</span>
      </div>
    </div>
  );
}
