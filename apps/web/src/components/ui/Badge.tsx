interface Props {
  label: string;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange';
}

const colors = {
  green:  'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400',
  red:    'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  blue:   'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400',
  gray:   'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-400',
};

export function Badge({ label, color = 'gray' }: Props) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${colors[color]}`}>
      {label}
    </span>
  );
}
