document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('add-booking-btn');
    const container = document.getElementById('holidays-container');
    const modal = document.getElementById('booking-modal');
    const closeBtn = document.getElementById('close-modal');
    const tabAi = document.getElementById('tab-ai');
    const tabManual = document.getElementById('tab-manual');
    const formAi = document.getElementById('form-ai');
    const formManual = document.getElementById('form-manual');
    const flightsContainer = document.getElementById('flights-container');
    const hotelsContainer = document.getElementById('hotels-container');
    
    const confirmModal = document.getElementById('confirm-modal');
    const cancelConfirmBtn = document.getElementById('confirm-cancel-btn');
    const deleteConfirmBtn = document.getElementById('confirm-delete-btn');

    let holidaysData = [];
    let idToDelete = null; 

    function formatDate(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    function getAirlineLogo(airlineName) {
        if (!airlineName) return '✈️';
        
        const name = airlineName.toLowerCase();
        
        const domains = {
            'ryanair': 'ryanair.com',
            'aer lingus': 'aerlingus.com',
            'british airways': 'britishairways.com',
            'emirates': 'emirates.com',
            'delta': 'delta.com',
            'american airlines': 'aa.com',
            'united': 'united.com',
            'lufthansa': 'lufthansa.com',
            'air france': 'airfrance.com',
            'klm': 'klm.com',
            'vueling': 'vueling.com',
            'easyjet': 'easyjet.com',
            'wizz': 'wizzair.com',
            'qatar': 'qatarairways.com',
            'etihad': 'etihad.com',
            'turkish': 'turkishairlines.com',
            'virgin': 'virginatlantic.com',
            'sas': 'flysas.com',
            'norwegian': 'norwegian.com',
            'tap': 'flytap.com',
            'iberia': 'iberia.com'
        };

        for (const [key, domain] of Object.entries(domains)) {
            if (name.includes(key)) {
                return `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=128" alt="${key} logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 6px;">`;
            }
        }
        
        return '✈️';
    }

    function parseBookingData(booking) {
        if (booking.raw_json) return JSON.parse(booking.raw_json);
        let data = {};
        if (booking.type === 'flight') {
            data.airline = booking.title;
            const refMatch = booking.details.match(/\(Ref: (.*?)\)/);
            data.ref = refMatch ? refMatch[1] : '';
            const parts = booking.details.replace(/\s*\(Ref: .*?\)/, '').split(' - ');
            if (parts.length >= 2) {
                data.date = parts[0].trim();
                const route = parts[1].split(' to ');
                if (route.length >= 2) { data.origin = route[0].trim(); data.destination = route[1].trim(); }
            }
        } else if (booking.type === 'hotel') {
            data.name = booking.title;
            const refMatch = booking.details.match(/\(Ref: (.*?)\)/);
            data.ref = refMatch ? refMatch[1] : '';
            const parts = booking.details.replace(/\s*\(Ref: .*?\)/, '').split(' to ');
            if (parts.length >= 2) { data.checkIn = parts[0].trim(); data.checkOut = parts[1].trim(); }
        }
        return data;
    }

    function createFlightBlock(data = {}) {
        const html = `
            <div class="dynamic-item flight-item">
                <button type="button" class="remove-btn" onclick="this.parentElement.remove()">✕</button>
                
                <label class="micro-label">Airline</label>
                <input type="text" placeholder="Airline" class="flight-airline" list="airlines-list" required value="${data.airline || ''}">
                
                <div class="date-row">
                    <div><label class="micro-label">Origin</label><input type="text" class="flight-origin" list="airports-list" required value="${data.origin || ''}"></div>
                    <div><label class="micro-label">Destination</label><input type="text" class="flight-dest" list="airports-list" required value="${data.destination || ''}"></div>
                </div>
                <label class="micro-label">Flight Date</label>
                <input type="date" class="flight-date" required value="${data.date || ''}">
                
                <label class="micro-label">Booking Reference</label>
                <input type="text" placeholder="e.g. W6ID2H" class="flight-ref" value="${data.ref || ''}" style="margin-bottom: 0;">
            </div>`;
        flightsContainer.insertAdjacentHTML('beforeend', html);
    }

    function createHotelBlock(data = {}) {
        const uniqueId = 'hotel-' + Date.now() + Math.floor(Math.random() * 1000);
        const html = `
            <div class="dynamic-item hotel-item">
                <button type="button" class="remove-btn" onclick="this.parentElement.remove()">✕</button>
                
                <label class="micro-label">Hotel Name</label>
                <input type="text" placeholder="Hotel Name" class="hotel-name" required value="${data.name || ''}">
                
                <label class="micro-label">Dates</label>
                <input type="text" id="${uniqueId}" class="hotel-range" placeholder="Select dates..." required>
                
                <label class="micro-label" style="margin-top:10px;">Booking Reference</label>
                <input type="text" placeholder="e.g. JPN123" class="hotel-ref" value="${data.ref || ''}" style="margin-bottom: 0;">
            </div>`;
        hotelsContainer.insertAdjacentHTML('beforeend', html);
        flatpickr(document.getElementById(uniqueId), { mode: "range", dateFormat: "Y-m-d", defaultDate: (data.checkIn && data.checkOut) ? [data.checkIn, data.checkOut] : null });
    }

    async function fetchHolidays() {
        try {
            const response = await fetch('/api.php?action=get_holidays');
            holidaysData = await response.json(); 
            renderHolidays(holidaysData);
        } catch(e) { console.error(e); }
    }

    function renderHolidays(holidays) {
        container.innerHTML = holidays.length ? '' : '<p style="text-align: center; padding: 40px; color: #666;">No holidays booked yet!</p>';
        holidays.forEach(holiday => {
            const card = document.createElement('article');
            card.className = 'holiday-card';
            let bookingsHTML = '';
            
            if (holiday.bookings) {
                holiday.bookings.sort((a, b) => {
                    const dA = parseBookingData(a); const dB = parseBookingData(b);
                    return new Date(a.type === 'flight' ? dA.date : dA.checkIn) - new Date(b.type === 'flight' ? dB.date : dB.checkIn);
                }).forEach(booking => {
                    const d = parseBookingData(booking);
                    
                    if (booking.type === 'flight') {
                        bookingsHTML += `
                            <div class="booking-item modern-booking flight">
                                <div class="booking-icon">${getAirlineLogo(d.airline)}</div>
                                <div class="booking-content">
                                    <div class="booking-header">
                                        <span class="booking-route">${d.origin} → ${d.destination}</span>
                                        <span class="booking-date">${formatDate(d.date)}</span>
                                    </div>
                                    <div class="booking-meta">
                                        <span class="booking-vendor">${d.airline}</span>
                                        ${d.ref ? `<span class="booking-ref">Ref: ${d.ref}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    } else if (booking.type === 'hotel') {
                        bookingsHTML += `
                            <div class="booking-item modern-booking hotel">
                                <div class="booking-icon">🏨</div>
                                <div class="booking-content">
                                    <div class="booking-header">
                                        <span class="booking-route">Hotel / Stay</span>
                                        <span class="booking-date">${formatDate(d.checkIn)} — ${formatDate(d.checkOut)}</span>
                                    </div>
                                    <div class="booking-meta">
                                        <span class="booking-vendor">${d.name}</span>
                                        ${d.ref ? `<span class="booking-ref">Ref: ${d.ref}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                });
            }
            card.innerHTML = `<div class="image-container"><img src="${holiday.image}" class="destination-img"><h2 class="destination-title">${holiday.title}</h2><div style="position:absolute; top:15px; right:15px;"><button class="edit-btn" data-id="${holiday.id}">✏️ Edit</button><button class="delete-btn" data-id="${holiday.id}">🗑️</button></div></div><div class="card-content">${bookingsHTML}</div>`;
            container.appendChild(card);
        });
        
        document.querySelectorAll('.edit-btn').forEach(b => b.onclick = () => openEditModal(b.dataset.id));
        document.querySelectorAll('.delete-btn').forEach(b => b.onclick = () => { idToDelete = b.dataset.id; confirmModal.classList.add('show'); });
    }

    cancelConfirmBtn.onclick = () => { confirmModal.classList.remove('show'); idToDelete = null; };

    deleteConfirmBtn.onclick = async () => {
        if (!idToDelete) return;
        try {
            const response = await fetch('/api.php?action=delete_holiday', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: idToDelete })
            });
            const result = await response.json();
            if (result.status === 'success') {
                confirmModal.classList.remove('show');
                fetchHolidays();
            }
        } catch (err) { console.error("Delete failed:", err); } 
        finally { idToDelete = null; }
    };

    function openEditModal(id, inject = null) {
        const h = holidaysData.find(x => x.id == id);
        document.getElementById('manual-holiday-id').value = h.id;
        document.getElementById('manual-holiday').value = h.title;
        flightsContainer.innerHTML = ''; hotelsContainer.innerHTML = '';
        
        h.bookings.forEach(b => { const d = parseBookingData(b); b.type === 'flight' ? createFlightBlock(d) : createHotelBlock(d); });
        
        if (inject) {
            if (inject.flights && Array.isArray(inject.flights)) { inject.flights.forEach(f => createFlightBlock(f)); }
            if (inject.hotels && Array.isArray(inject.hotels)) { inject.hotels.forEach(h => createHotelBlock(h)); }
        }
        tabManual.click(); modal.classList.add('show');
    }

    formAi.onsubmit = async (e) => {
        e.preventDefault();
        const btn = formAi.querySelector('button'); 
        const loadingOverlay = document.getElementById('ai-loading-overlay');
        
        btn.disabled = true;
        loadingOverlay.style.display = 'flex';
        
        const summary = holidaysData.map(h => ({ id: h.id, title: h.title, dates: h.bookings.map(b => { const d = parseBookingData(b); return b.type === 'flight' ? d.date : d.checkIn; }) }));
        
        try {
            const r = await fetch('/api.php?action=extract_ai', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: document.getElementById('ai-email-text').value, existing_holidays: summary }) 
            });
            
            const rawText = await r.text();
            let res;
            
            try {
                res = JSON.parse(rawText);
            } catch (parseErr) {
                console.error("Server did not return JSON. Raw response was:", rawText);
                throw new Error("Invalid response from server.");
            }

            if (res.status === 'error') {
                alert(res.message);
                return;
            }

            if (res.holiday_id) {
                openEditModal(res.holiday_id, res);
            } else { 
                document.getElementById('manual-holiday-id').value = ''; 
                document.getElementById('manual-holiday').value = res.suggested_title || "New Trip";
                flightsContainer.innerHTML = ''; hotelsContainer.innerHTML = '';
                
                if (res.flights && Array.isArray(res.flights)) { res.flights.forEach(f => createFlightBlock(f)); }
                if (res.hotels && Array.isArray(res.hotels)) { res.hotels.forEach(h => createHotelBlock(h)); }
                tabManual.click();
            }
            document.getElementById('ai-email-text').value = '';
            
        } catch (err) { 
            console.error("Full Error Output:", err);
            alert("Extraction failed. Check the console."); 
        } finally { 
            btn.disabled = false; 
            loadingOverlay.style.display = 'none';
        }
    };

    formManual.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            id: document.getElementById('manual-holiday-id').value, title: document.getElementById('manual-holiday').value,
            flights: Array.from(document.querySelectorAll('.flight-item')).map(i => ({ airline: i.querySelector('.flight-airline').value, origin: i.querySelector('.flight-origin').value, destination: i.querySelector('.flight-dest').value, date: i.querySelector('.flight-date').value, ref: i.querySelector('.flight-ref').value })),
            hotels: Array.from(document.querySelectorAll('.hotel-item')).map(i => { const d = i.querySelector('.hotel-range').value.split(' to '); return { name: i.querySelector('.hotel-name').value, checkIn: d[0] || '', checkOut: d[1] || d[0] || '', ref: i.querySelector('.hotel-ref').value }; })
        };
        await fetch('/api.php?action=save_manual', { method: 'POST', body: JSON.stringify(payload) });
        modal.classList.remove('show'); fetchHolidays();
    };

    fetchHolidays();
    addBtn.onclick = () => { document.getElementById('manual-holiday-id').value = ''; formManual.reset(); flightsContainer.innerHTML = ''; hotelsContainer.innerHTML = ''; createFlightBlock(); modal.classList.add('show'); };
    closeBtn.onclick = () => modal.classList.remove('show');
    tabAi.onclick = () => { tabAi.classList.add('active'); tabManual.classList.remove('active'); formAi.classList.add('active'); formManual.classList.remove('active'); };
    tabManual.onclick = () => { tabManual.classList.add('active'); tabAi.classList.remove('active'); formManual.classList.add('active'); formAi.classList.remove('active'); };
    
    document.getElementById('add-flight-btn').onclick = () => createFlightBlock();
    document.getElementById('add-hotel-btn').onclick = () => createHotelBlock();
});