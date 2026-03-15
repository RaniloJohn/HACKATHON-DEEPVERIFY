
const id = "88160925-c714-4e64-8d21-99c33239ccec";
const url = "https://boicjvvybqwjcscmyyos.supabase.co/rest/v1/scans?id=eq." + id + "&select=*";
const apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvaWNqdnZ5YnF3amNzY215eW9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNTg3ODAsImV4cCI6MjA4ODYzNDc4MH0.0nym1pkA5LgLYKvIRLTbgZS--BmEbOIfKNq5-KasAl8";
const auth = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvaWNqdnZ5YnF3amNzY215eW9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA1ODc4MCwiZXhwIjoyMDg4NjM0NzgwfQ.I0llORZkEYh0Y8_iCBHE3gSI1sjK6i4RURc3IR4VsYA";

async function run() {
    console.log(`Fetching ${id}...`);
    try {
        const res = await fetch(url, {
            headers: {
                "apikey": apikey,
                "Authorization": auth
            }
        });
        const data = await res.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
