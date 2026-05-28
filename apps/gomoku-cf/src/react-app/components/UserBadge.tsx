import type { Identity } from "../hooks/useIdentity";

interface Props {
	identity: Identity;
	onSignOut: () => void;
}

export function UserBadge({ identity, onSignOut }: Props) {
	return (
		<div className="flex items-center gap-2 text-sm">
			<span className="text-stone-300">{identity.username}</span>
			<button
				onClick={onSignOut}
				className="text-stone-500 hover:text-red-400 transition-colors"
				title="退出"
			>
				退出
			</button>
		</div>
	);
}
