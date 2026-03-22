import os
import logging
import requests as http_requests
import aiohttp
from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.agents.llm import function_tool
from livekit.plugins import openai, deepgram, silero

# Load root .env from the monorepo configuration securely
load_dotenv(dotenv_path="../.env")

logger = logging.getLogger("frontdesk-agent")

# Microservice API endpoints internally
HELP_REQUEST_URL = "http://localhost:3001/api/requests"
KB_SEARCH_URL = "http://localhost:3002/api/search"

SYSTEM_PROMPT = """You are a helpful receptionist for 'Lumiere Salon'. 
Your job is to answer customer questions about our salon (hours: 9am-6pm, services: haircuts and coloring).
If the customer asks a question you do not know the answer to, you MUST use the `escalate_to_supervisor` tool immediately. Do not make up answers.
If the customer asks if the supervisor has replied yet or checks the status of their request, use the `check_escalation_status` tool with the original question they asked!
"""


class FrontdeskAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions=SYSTEM_PROMPT,
        )
        self.escalated_questions = set()

    @function_tool()
    async def escalate_to_supervisor(
        self,
        caller_phone: str,
        question: str,
    ):
        """Escalates a question to the human supervisor when you do not know the answer.
        
        Args:
            caller_phone: The phone number of the caller (make a fake one up if not known)
            question: The specific question you cannot answer
        """
        normalized_q = question.lower().strip()
        if normalized_q in self.escalated_questions:
            return "I have already escalated this exact question to my supervisor. I am just waiting for their reply."
            
        self.escalated_questions.add(normalized_q)
        logger.info(f"Escalating: {question} for {caller_phone}")
        
        # Phase 6 Core requirement: Check Knowledge Base first (graceful fallback)
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(KB_SEARCH_URL, json={"query": question}, timeout=3) as kb_res:
                    if kb_res.status == 200:
                        data = await kb_res.json()
                        hits = data.get("hits", [])
                        if hits:
                            return f"I actually just found the answer in my knowledge base: {hits[0]['answer']}"
        except Exception as kb_err:
            logger.warning(f"KB lookup failed (non-critical): {kb_err}")

        # If genuinely unresolved, push to Help Request Service API
        try:
            payload = {
                "caller_phone": caller_phone or "+15550000000",
                "question": question,
                "context": "Voice escalation."
            }
            async with aiohttp.ClientSession() as session:
                async with session.post(HELP_REQUEST_URL, json=payload, timeout=3) as res:
                    if res.status == 201:
                        return "I have submitted the request to my supervisor. I will text you as soon as they reply!"
                    else:
                        return "I had trouble contacting my supervisor, please try again later."
        except Exception as e:
            logger.error(f"Escalation to help-request failed: {e}")
            return "Sorry, my internal systems are down. I cannot escalate right now."

    @function_tool()
    async def check_escalation_status(
        self,
        question: str,
    ):
        """Checks if the supervisor has responded to a previously escalated question.
        
        Args:
            question: The original question that was escalated to the supervisor previously
        """
        logger.info(f"Checking status for question: {question}")
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(KB_SEARCH_URL, json={"query": question}, timeout=3) as kb_res:
                    if kb_res.status == 200:
                        data = await kb_res.json()
                        hits = data.get("hits", [])
                        if hits:
                            return f"Yes, the supervisor responded: {hits[0]['answer']}"
            return "No, the supervisor has not responded yet. We are still waiting."
        except Exception as kb_err:
            logger.warning(f"KB lookup failed (non-critical): {kb_err}")
            return "I'm having trouble checking the status right now."



async def entrypoint(ctx: JobContext):
    logger.info("Initializing Agent Session...")

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=deepgram.STT(),
        llm=openai.LLM(
            api_key=os.environ.get("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1",
            model="llama-3.3-70b-versatile"
        ),
        tts=deepgram.TTS(),
    )

    await session.start(
        room=ctx.room,
        agent=FrontdeskAgent(),
    )

    await session.say("Welcome to Lumiere Salon! How can I help you today?", allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
