const BNN_EMOJI = '🍌'
const PARTICLE_COUNT = 24
const DURATION_MS = 2000

type Particle = {
	id: number
	emoji: string
	x: number
	y: number
	rotation: number
	velocityX: number
	velocityY: number
	opacity: number
	scale: number
}

function createParticles(centerX: number, centerY: number): Particle[] {
	const particles: Particle[] = []
	for (let i = 0; i < PARTICLE_COUNT; i++) {
		const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.5
		const speed = 80 + Math.random() * 120
		particles.push({
			id: i,
			emoji: BNN_EMOJI,
			x: centerX,
			y: centerY,
			rotation: Math.random() * 360,
			velocityX: Math.cos(angle) * speed,
			velocityY: Math.sin(angle) * speed - 60,
			opacity: 1,
			scale: 0.8 + Math.random() * 0.6,
		})
	}
	return particles
}

export function fireEmojiConfetti() {
		const container = document.createElement('div')
		container.setAttribute('aria-hidden', 'true')
		container.style.cssText = `
			position: fixed;
			inset: 0;
			pointer-events: none;
			z-index: 9999;
			overflow: hidden;
		`
		document.body.appendChild(container)

		const centerX = window.innerWidth / 2
		const centerY = window.innerHeight / 2
		const particles = createParticles(centerX, centerY)

		particles.forEach((p) => {
			const el = document.createElement('div')
			el.style.cssText = `
				position: absolute;
				left: ${p.x}px;
				top: ${p.y}px;
				font-size: 28px;
				transform: translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.scale});
				opacity: ${p.opacity};
				transition: none;
			`
			el.textContent = p.emoji
			container.appendChild(el)

			const startTime = performance.now()
			function animate(currentTime: number) {
				const elapsed = (currentTime - startTime) / 1000
				const progress = elapsed / (DURATION_MS / 1000)
				if (progress >= 1) {
					el.remove()
					return
				}
				const x = p.x + p.velocityX * elapsed
				const y = p.y + p.velocityY * elapsed + 200 * elapsed * elapsed
				const opacity = 1 - progress
				const rotation = p.rotation + elapsed * 180
				el.style.left = `${x}px`
				el.style.top = `${y}px`
				el.style.opacity = `${opacity}`
				el.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${p.scale})`
				requestAnimationFrame(animate)
			}
			requestAnimationFrame(animate)
		})

		setTimeout(() => {
			container.remove()
		}, DURATION_MS + 100)
}

export function useEmojiConfetti() {
	return { fire: fireEmojiConfetti }
}
