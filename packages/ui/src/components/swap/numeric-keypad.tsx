import { Delete } from 'lucide-react'

type NumericKeypadProps = {
	onKey: (key: string) => void
	onDelete: () => void
}

export function NumericKeypad({ onKey, onDelete }: NumericKeypadProps) {
	const keys = [
		['1', '2', '3'],
		['4', '5', '6'],
		['7', '8', '9'],
		['.', '0', 'del'],
	]

	return (
		<div className="grid grid-cols-3 gap-2 px-4">
			{keys.flat().map((key) => (
				<button
					key={key}
					type="button"
					aria-label={key === 'del' ? 'Delete' : `Key ${key}`}
					className="keypad-key flex items-center justify-center min-h-[56px] min-w-[44px] rounded-xl text-foreground text-2xl numeric font-semibold active:bg-secondary transition-colors"
					onClick={() => {
						if (key === 'del') {
							onDelete()
						} else {
							onKey(key)
						}
					}}
				>
					{key === 'del' ? (
						<Delete className="w-6 h-6 text-foreground" />
					) : (
						key
					)}
				</button>
			))}
		</div>
	)
}
