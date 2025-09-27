import { LightningElement } from 'lwc';
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import CART_CHANGED from '@salesforce/messageChannel/lightning__commerce_cartChanged';

import getMyPartList from '@salesforce/apex/LSTA_PartsOrderMyPartListController.getMyPartList';
import removePartList from '@salesforce/apex/LSTA_PartsOrderMyPartListController.removePartList';
import removeAllyPartListItems from '@salesforce/apex/LSTA_PartsOrderMyPartListController.removeAllyPartListItems';
import removeMyPartListItems from '@salesforce/apex/LSTA_PartsOrderMyPartListController.removeMyPartListItems';
import parseMyPartsItemCSVFile from '@salesforce/apex/LSTA_PartsOrderMyPartListController.parseMyPartsItemCSVFile';
import getStockInformation from '@salesforce/apex/LSTA_PartsOrderMyPartListController.getStockInformation';

const MENU_MODAL_ACTION_CREATE = 'create';
const MENU_MODAL_ACTION_EDIT = 'edit';


// refresh
            // const wishlistIndex = this.wishlistIndexById[this.myPartsListItem.Id];
            // if (wishlistIndex === -1) {
            //     this.showToast(
            //         'Add Part',
            //         `handleAddPartModalSuccess: error on detail.wishlistId : ${detail.wishlistId}`,
            //         'error'
            //     );
            //     return;
            // };
            // this.selectListByIndex(wishlistIndex);
// getwishlistid
// method이름정리 순서정리

export default class Lsta_PartOrderMyPartList extends LightningElement {

    columns = [
        { label: 'Sales Status', fieldName: 'salesStatus', initialWidth: 140 },
        { label: 'Part No', fieldName: 'partNo', initialWidth: 120 },
        { label: 'Old Part Number', fieldName: 'oldPartNumber', initialWidth: 150 },
        { label: 'Part Name', fieldName: 'partName', initialWidth: 200 },
        { label: 'Stock', fieldName: 'stock', initialWidth: 105 },
        { label: 'Qty', fieldName: 'qty', type: 'number', initialWidth: 105 },
        { label: 'Unit Price', fieldName: 'unitPrice', type: 'currency', initialWidth: 135 },
        { label: 'Billed Amount', fieldName: 'billedAmount', type: 'currency', initialWidth: 150 },
        { label: 'Latest Order Date', fieldName: 'latestOrderDate', type: 'date', initialWidth: 160 },
        { label: 'Latest Order Quantity', fieldName: 'latestOrderQuantity', type: 'number', initialWidth: 185 },
        { label: 'Initial Wishlist Registration Date', fieldName: 'registrationDate', type: 'date', initialWidth: 250 },
        { label: 'Model Name', fieldName: 'modelName', initialWidth: 300 },
        { label: 'Notes', fieldName: 'notes', initialWidth: 110 },
        { label: 'Remark', fieldName: 'remark', initialWidth: 130 }
    ];

    showCreateListModal;
    showEditListModal;
    showAddPartModal;
    showAddToListModal;
    showUploadSection;
    showCompSetModal;

    isLoading;
    isStockLoading;
    showMenuModal = false;
    menuModalAction;

    partsList = [];
    targetList = [];
    myPartsListColumns = [];
    partsToAddToMyPartsListColumns = [];

    // 서버에서 listWishlist 를 list로 주기 때문
    wishlistIndexById = {};
    // 전체 데이터
    myPartsList = [];
    // 전체 데이터 중 찜목록 하나
    myPartsListItem = {};
    // Datatable 출력용
    wishlistItemsDataTableRows = [];
    // 재고
    stockByPartNumber = {};
    allPartNumbersToQueryStock = [];

    selectedRowIds = [];
    selectedItems = [];

    isUploadMyPartListFile = false;
    isCloneMyParts = false;

    partsCloneTableColums = []; // (원문 표기 유지)
    isTypeClone = true;

    draftValues = [];
    draftValueMap = {}; // 필요 시 new Map() 으로 교체 가능

    isShowCompSet = false;
    checkPartNumber = {};
    checkQuantity = 0;

    selectedLeftModalBuffer = [];
    partsToCart = [];

    isDistributor = false;

    orderTypeOptions = [
        { label: 'Default Delivery', value: 'Default Delivery' }, // 일반주문
        { label: 'StandingOrder Delivery', value: 'StandingOrder Delivery' }, // 정기주문
        { label: 'DirectOrder Delivery', value: 'DirectOrder Delivery' }, // 직송주문
        { label: 'DirectPaymentOrder Delivery', value: 'DirectPaymentOrder Delivery' } // 직납주문
    ];

    selectedOrderType = 'Default Delivery';

    sitePrefix = '';


    get displayNoData() {
        const items = this.myPartsListItem?.WishlistItems;
        return !items || items.length === 0;
    }

    get trueVar() {
        return true;
    }

    async connectedCallback() {
        await this.queryMyPartList();
        this.selectListByIndex(0);
    }

    // 전체쿼리
    async queryMyPartList() {
        this.isLoading = true;
        try {
            const { result, payload } = await getMyPartList();
            if (result !== 'OK') {
                this.myPartsList = [];
                this.myPartsListItem = {};
                this.showToast('Error', message || 'Error getting wishlist', 'error');
                return;
            }
            console.log('queryMyPartList');
            console.log(payload);

            this.myPartsList = Array.isArray(payload.listWishlist) ? payload.listWishlist : [];
            this.pricebookEntryMap = payload.mapPricebookEntry ?? {};

            if (this.myPartsList.length > 0) {
                this.myPartsList.forEach((wishlist, index) => {
                    if (wishlist?.Id) {
                        this.wishlistIndexById[wishlist.Id] = index;
                    }
                });
            } else {
                this.myPartsListItem = {};
            }
        } catch (error) {
            console.error(error);
            this.myPartsList = [];
            this.myPartsListItem = {};
            this.showToast('Error', error.body?.message || error.message || 'Error getting wishlist', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // 재고쿼리후 재고맵 this.stockByPartNumber에 upsert
    // 쿼리할 part number 리스트. Product2.Part__r.Partnum__c
    async queryStock(partNumbers) {
        try {
            const mapData = { partNumbers };

            console.log('queryStock');
            // not found와 0을 구별 요청할 수 있나?
            const response = await getStockInformation({ mapData });
            if (response?.result !== 'OK') {
                const message = response?.message || 'failed to query stock';
                throw new Error(message);
            }
            
            const payload = response?.payload ?? {};
            this.stockByPartNumber = {
                ...this.stockByPartNumber, 
                ...payload
            };

            this.wishlistItemsDataTableRows = this.formatWishlistItemsForDataTable();
        } catch (error) {
            console.error(error);
            this.myPartsList = [];
            this.myPartsListItem = {};
            this.showToast('오류', error.body?.message || error.message || '내 파트 리스트 조회에 실패했습니다.', 'error');
        }
    }

    // index번째 리스트 선택 -> 이 선택을 바깥으로 빼자
    // 이때 현재리스트의 리스트의 재고를 쿼리한다
    async selectListByIndex(wishlistIndex) {
        console.log('selectListByIndex');
        this.isStockLoading = true;
        const listChanged = !this.isSelectedCurrentList(wishlistIndex);
        if (listChanged) {
            this.partNumbers = [];
            this.stockByPartNumber = {};
        } 

        this.myPartsListItem = this.myPartsList[wishlistIndex];
        this.selectedRowIds = [];
        this.wishlistItemsDataTableRows = this.formatWishlistItemsForDataTable();

        // 이미 index번째 리스트에 있었던 경우, this.partNumbers에 없던 것들만 쿼리해서 붙인다
        const newlyAddedPartNumbers = this.mergePartNumbersAndExtractNew(this.myPartsListItem?.WishlistItems);
        const targetPartNumbers = listChanged ? this.partNumbers : newlyAddedPartNumbers;

        if (Array.isArray(targetPartNumbers) && targetPartNumbers.length > 0) {
            try {
                await this.queryStock(targetPartNumbers, wishlistIndex);
            } catch (error) {
                console.error("queryStock failed:", error);
            } finally {
                this.isStockLoading = false;
                // this.selectListByIndex(wishlistIndex);
            }
        }
        this.isStockLoading = false;
    }

    isSelectedCurrentList(wishlistIndex) {
        return wishlistIndex === this.wishlistIndexById[this.myPartsListItem.Id];
    }
    
    mergePartNumbersAndExtractNew(wishlistItems) {
        const currentPartNumbers = Array.isArray(this.partNumbers) ? this.partNumbers : [];
        const uniqueSet = new Set(currentPartNumbers);
        const newlyAddedPartNumbers = [];

        for (const wishlistItem of wishlistItems ?? []) {
            const partNumber = wishlistItem?.Product2?.Part__r?.Partnum__c ?? null;

            if (typeof partNumber === "string") {
                const trimmed = partNumber.trim();
                if (trimmed.length > 0 && !uniqueSet.has(trimmed)) {
                    uniqueSet.add(trimmed);
                    newlyAddedPartNumbers.push(trimmed);
                }
            }
        }

        this.partNumbers = [...uniqueSet];
        return newlyAddedPartNumbers;
    }

    // datatable에 넣기위한 포맷
    formatWishlistItemForDataTable(wishlistItem) {
        if (!wishlistItem) {
            return null;
        }

        const unitPrice = this.pricebookEntryMap?.[wishlistItem.Product2Id]?.UnitPrice ?? 0;
        const vatIncludedUnitPrice = Math.round(unitPrice * 1.1);

        const stock = this.isStockLoading
            ? (this.stockByPartNumber[wishlistItem.Product2?.Part__r?.Partnum__c] ?? "is Loading...")
            : (this.stockByPartNumber[wishlistItem.Product2?.Part__r?.Partnum__c] ?? 0);

        return {
            id: wishlistItem.Id,
            salesStatus: wishlistItem.Product2?.Part__r?.isSalesPart__c ? '' : 'Not for sale',
            partNo: wishlistItem.Product2?.Part__r?.Partnum__c,
            oldPartNumber: wishlistItem.Product2?.Part__r?.OldPartnum__c,
            partName: wishlistItem.Product2?.Part__r?.NameEng__c,
            stock: stock,
            qty: wishlistItem.Quantity__c,
            unitPrice: unitPrice,
            billedAmount: this.isDistributor
                ? wishlistItem.Quantity__c * unitPrice
                : wishlistItem.Quantity__c * vatIncludedUnitPrice,
            latestOrderDate: wishlistItem.LastOrderedDate__c
                ? this.toFormatDate(wishlistItem.LastOrderedDate__c)
                : '-',
            latestOrderQuantity: wishlistItem.LastQuantity__c ?? 0,
            registrationDate: this.toFormatDate(wishlistItem.CreatedDate),
            modelName: wishlistItem.Product2?.fm_Model_Names__c,
            notes: wishlistItem.Product2?.REF__c,
            remark: wishlistItem.Remark__c
        };
    }
    
    formatWishlistItemsForDataTable() {
        return (this.myPartsListItem.WishlistItems ?? []).map((wishlistItem) =>
            this.formatWishlistItemForDataTable(wishlistItem)
        );
    }

    toFormatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
    }

    handleDivClick() {
        const menu = this.template.querySelector('[data-id="wishlistMenu"]');
        if (menu) {
            const triggerButton = menu.shadowRoot.querySelector('button');
            console.log(triggerButton);
            if (triggerButton) {
                console.log('triggerButton exists');
                triggerButton.click();
            }
        }
    }

    // 리스트 선택
    handleListSelect(event) {
        const wishlistId = event.detail.value;
        this.selectListByIndex(this.wishlistIndexById[wishlistId]);
    }

    // 리스트에 대한 동작 선택
    handleMenuSelect(event) {
        const selected = event.detail.value;
        switch (selected) {
            case 'create':
                this.menuModalAction = MENU_MODAL_ACTION_CREATE;
                this.showMenuModal = true;
                break;
            case 'edit':
                this.menuModalAction = MENU_MODAL_ACTION_EDIT;
                this.showMenuModal = true;
                break;
            case 'clear':
                this.handleClickClearList();
                break;
            case 'delete':
                this.handleClickDeleteList();
                break;
            default:
        }
        console.log('handleMenuSelect');
        console.log(this.myPartsList);
    }

    // edit list와 create list는 lsta_PartOrderMyPartListListModal를 사용
    handleMenuModalClose() {
        this.menuModalAction = null;
        this.showMenuModal = false;
    }
    handleMenuModalSuccess(event) {
        const data = event.detail;
        if (!data) {
            return;
        }
        const payload = data.payload;

        if (data.action === MENU_MODAL_ACTION_CREATE) {
            this.myPartsList = [...this.myPartsList, payload];

            this.wishlistIndexById[payload.Id] = this.myPartsList.length - 1;
            this.selectListByIndex(this.myPartsList.length - 1);

        } else if (data.action === MENU_MODAL_ACTION_EDIT) {
            const index = this.wishlistIndexById[payload.Id];
            if (index !== undefined) {
                const updatedList = [...this.myPartsList];
                updatedList[index] = { ...this.myPartsList[index], ...payload };
                this.myPartsList = updatedList;

                this.selectListByIndex(index);
            } else {
                console.warn('리스트에서 해당 Id를 찾지 못했습니다:', payload.Id);
            }
        }
    }

    async handleClickClearList() {
        this.isLoading = true;
        const wishlistId = this.myPartsListItem.Id;

        try {
            const mapData = {
                Id: wishlistId,
            };

            const response = await removeAllyPartListItems({ mapData });
            if (response?.result !== 'OK') {
                const message = response?.message || 'Clear failed.';
                throw new Error(message);
            }
            delete this.myPartsListItem.WishlistItems;
            this.showToast('Success', 'Wishlist cleared.', 'success');
        } catch (error) {
            this.showToast('Error', error?.message || 'Unexpected error.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleClickDeleteList() {
        this.isLoading = true;
        const wishlistId = this.myPartsListItem.Id;
        try {
            const mapData = {
                Id: wishlistId,
            };

            const response = await removePartList({ mapData });
            if (response?.result !== 'OK') {
                const message = response?.message || 'Delete failed.';
                throw new Error(message);
            }
            this.showToast('Success', 'Wishlist deleted.', 'success');
            
            const index = this.wishlistIndexById[wishlistId];
            if (index !== undefined) {
                const updatedList = [...this.myPartsList];
                updatedList.splice(index, 1);
                this.myPartsList = updatedList;

                this.wishlistIndexById = {};
                this.myPartsList.forEach((item, idx) => {
                    this.wishlistIndexById[item.Id] = idx;
                });
            }

            this.selectListByIndex(0);

        } catch (error) {
            this.showToast('Error', error?.message || 'Unexpected error.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleRowSelection(event) {
        this.selectedRowIds = event.detail.selectedRows.map(row => row.id);
    }

    // add part
    handleClickAddPart(event) {
        this.showAddPartModal = true;
    }
    handleAddPartModalClose() {
        this.showAddPartModal = false;
    }
    handleAddPartModalSuccess(event) {
        const data = event.detail;
        if (!data) {
            return;
        }
        const { wishlistId, payload } = data;

        const wishlistIndex = this.wishlistIndexById[wishlistId];
        if (wishlistIndex === -1) {
            this.showToast(
                'Add Part',
                `handleAddPartModalSuccess: error on detail.wishlistId : ${detail.wishlistId}`,
                'error'
            );
            return;
        };
        const wishlist = this.myPartsList[wishlistIndex];

        const updateWishlistItems = (payload) => {
            payload.forEach(item => {

                const items = wishlist.WishlistItems || [];
                const itemIndex = items.findIndex(wi => wi.Id === item.Id);

                if (itemIndex !== -1) {
                    items[itemIndex] = {
                        ...items[itemIndex],
                        ...item
                    };
                } else {
                    items.push({ ...item });
                }
                this.myPartsList[wishlistIndex] = {
                    ...this.myPartsList[wishlistIndex],
                    WishlistItems: items,
                    WishlistProductCount: items.length
                };
            });
        };
        updateWishlistItems(payload);
        this.selectListByIndex(wishlistIndex);
    };

    async handleClickDeletePart(event) {

        if (!this.selectedRowIds || this.selectedRowIds.length === 0) {
            this.showToast('Error', 'Please select parts to delete.', 'error');
            return;
        }

        this.isLoading = true;
        try {
            const mapData = {
                Id: this.selectedRowIds,
            };
            const response = await removeMyPartListItems({ mapData });
            if (response?.result !== 'OK') {
                const message = response?.message || 'Delete failed.';
                throw new Error(message);
            }
            this.showToast('Success', 'Items deleted.', 'success');
            
            if (this.myPartsListItem?.WishlistItems) {
                this.myPartsListItem.WishlistItems = this.myPartsListItem.WishlistItems.filter(
                    item => !this.selectedRowIds.includes(item.Id)
                );
            }
            this.selectedRowIds = [];

            const wishlistIndex = this.wishlistIndexById[this.myPartsListItem.Id];
            if (wishlistIndex === -1) {
                this.showToast(
                    'Add Part',
                    `lsta_PartOrderMyPartList: error finding index. wishlistId : ${detail.wishlistId}`,
                    'error'
                );
                return;
            };
            this.selectListByIndex(wishlistIndex);

        } catch (error) {
            this.showToast('Error', error?.message || 'Unexpected error.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // csv
    handleClickDownloadCsvForm() {
        let csvContent = "data:text/csv;charset=utf-8,";
        let csvCols = ['Wishlist Name','Part No','Qty','Remark'];
        csvContent = "\ufeff" + csvCols.join(',') + "\r\n";
        let encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'Wishlist Upload Form.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    handleClickUploadCsv() {
        this.showUploadSection = !this.showUploadSection;
    }
    async handleUploadFinished(event) {
        const uploadedFiles = event.detail.files;
        this.isLoading = true;

        const wishlistId = this.myPartsListItem.Id;
        const wishlistIndex = this.wishlistIndexById[wishlistId];
        try {
            
            const mapData = {
                myPartsListId: wishlistId,
                contentDocumentId: uploadedFiles[0].documentId,
            };
            const response = await parseMyPartsItemCSVFile({ mapData });

            if (response?.result !== 'OK') {
                const message = response?.message || 'Save failed.';
                throw new Error(message);
            }
            this.showToast('Success', 'Wishlist saved.', 'success');
            
            const payload = response?.payload ?? {};
            const payloadItems = Array.isArray(payload) ? payload : [];

            console.log('handleUploadFinished');
            console.log(payload);

            // 어차피 이게 돌일이 없음 apex에서 한개만 보내줘서
            // 1) payload를 WishlistId로 그룹핑
            const groupedByWishlistId = new Map();
            for (const payloadItem of payloadItems) {
                if (!payloadItem || typeof payloadItem.Id !== "string") continue;

                const targetWishlistId = payloadItem.WishlistId;
                if (typeof targetWishlistId !== "string" || !targetWishlistId) continue; // WishlistId 없는 항목은 스킵

                if (!groupedByWishlistId.has(targetWishlistId)) {
                    groupedByWishlistId.set(targetWishlistId, []);
                }
                groupedByWishlistId.get(targetWishlistId).push(payloadItem);
            }

            // 2) 그룹별로 해당 위시리스트를 찾아서 머지 수행
            for (const [targetWishlistId, itemsForWishlist] of groupedByWishlistId.entries()) {
                // 해당 위시리스트 index 찾기 (맵 → 없으면 findIndex)
                let wishlistIndex =
                    typeof this.wishlistIndexById[targetWishlistId] === "number"
                        ? this.wishlistIndexById[targetWishlistId]
                        : this.myPartsList.findIndex(function (wishlist) {
                              return wishlist && wishlist.Id === targetWishlistId;
                          });

                if (wishlistIndex < 0) {
                    console.warn("Wishlist not found for WishlistId:", targetWishlistId);
                    continue;
                }

                const currentWishlist = this.myPartsList[wishlistIndex] || {};
                const currentWishlistItems = Array.isArray(currentWishlist.WishlistItems)
                    ? currentWishlist.WishlistItems
                    : [];

                const mergedMap = new Map(currentWishlistItems.map(function (item) {
                    return [item.Id, item];
                }));

                for (const payloadItem of itemsForWishlist) {
                    if (!payloadItem || typeof payloadItem.Id !== "string") continue;

                    if (mergedMap.has(payloadItem.Id)) {
                        const existingItem = mergedMap.get(payloadItem.Id);
                        mergedMap.set(payloadItem.Id, {
                            ...existingItem,
                            ...payloadItem,
                            WishlistId: targetWishlistId
                        });
                    } else {
                        mergedMap.set(payloadItem.Id, {
                            ...payloadItem,
                            WishlistId: targetWishlistId
                        });
                    }
                }

                const updatedWishlistItems = Array.from(mergedMap.values());

                // 결과 반영
                this.myPartsList[wishlistIndex] = {
                    ...currentWishlist,
                    WishlistItems: updatedWishlistItems,
                    WishlistProductCount: updatedWishlistItems.length
                };
            }

            this.selectListByIndex(wishlistIndex);

        } catch (error) {
            this.showToast('Error', error?.message || 'Unexpected error.', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // add to wishlist
    handleClickAddToList() {
        if (!this.selectedRowIds || this.selectedRowIds.length === 0) {
            this.showToast('Error', 'Please select parts to copy.', 'error');
            return;
        }

        const items = this.myPartsListItem?.WishlistItems || [];
        const selectedItems = items.filter(item =>
            this.selectedRowIds.includes(item.Id)
        );
        
        const listWishlist = (this.myPartsList || []).map(item => ({
            Id: item.Id,
            Name: item.Name
        }));
        
        this.listWishlist = listWishlist;
        this.selectedItems = selectedItems;
        this.showAddToListModal = true;
    }
    handleAddToListModalSuccess(event) {
        const data = event.detail;
        if (!data) {
            return;
        }
        const payload = data.payload;

        payload.forEach(item => {
            const wishlistId = item.WishlistId;
            const targetWishlist = this.myPartsList.find(w => w.Id === wishlistId);

            if (!targetWishlist) {
                return;
            }

            if (!Array.isArray(targetWishlist.WishlistItems)) {
                targetWishlist.WishlistItems = [];
            }

            const existing = targetWishlist.WishlistItems.find(wi => wi.Id === item.Id);

            if (existing) {
                existing.Quantity__c = item.Quantity__c;
            } else {
                targetWishlist.WishlistItems.push({ ...item });
            }
        });

        this.selectListByIndex(this.wishlistIndexById[this.myPartsListItem.Id]);
    }
    handleAddToListModalClose() {
        this.showAddToListModal = false;
    }

    // add to cart
    handleClickAddToCart(event) {
        if (!this.selectedRowIds || this.selectedRowIds.length === 0) {
            this.showToast('Error', 'Please select parts to copy.', 'error');
            return;
        }

        const items = this.myPartsListItem?.WishlistItems || [];
        const selectedItems = items.filter(item =>
            this.selectedRowIds.includes(item.Id)
        );
        this.selectedItems = selectedItems;
        const selectedBuffer = Array.isArray(this.selectedItems) ? this.selectedItems : [];
        this.partsToCart = selectedBuffer.filter((item) => item.isCompSet__c === false);
        this.selectedLeftModalBuffer = selectedBuffer.filter((item) => item.isCompSet__c === true);

        if (this.selectedLeftModalBuffer.length > 0) {
            const [removedElement, ...remaining] = this.selectedLeftModalBuffer;
            this.checkPartNumber = removedElement.Product2?.Part__r?.Partnum__c;
            this.checkQuantity = removedElement.Quantity__c;
            this.selectedLeftModalBuffer = remaining;
            this.showCompSetModal = true;
        } else {
            this.addToCart();
        }
    }

    handleAddPartCompSetModal(event) {
        const partNumbers =
            Array.isArray(event?.detail?.partNumbers)
                ? event.detail.partNumbers.filter(Boolean)
                : [];

        if (partNumbers.length === 0) {
            this.showToast('Error', 'No parts selected in modal.', 'error');
            this.continueCompSetFlow();
            return;
        }

        // 모달에서 선택된 파트들을 장바구니 후보에 합치기
        const partsFromModal = partNumbers.map((partNumber) => ({
            PartNumber: partNumber,
            Quantity__c: this.checkQuantity,
            isCompSet__c: false
        }));
        this.partsToCart = [...this.partsToCart, ...partsFromModal];

        // 다음 컴셋 아이템 진행 or 장바구니 반영
        this.continueCompSetFlow();
    }

    handleCompSetModalClose() {
        // 선택 없이 닫은 경우: 그냥 다음으로 진행
        this.continueCompSetFlow();
    }

    continueCompSetFlow() {
        if (this.selectedLeftModalBuffer.length > 0) {
            const [removedElement, ...remaining] = this.selectedLeftModalBuffer;
            this.checkPartNumber = removedElement.Product2?.Part__r?.Partnum__c;
            this.checkQuantity = removedElement.Quantity__c;
            this.selectedLeftModalBuffer = remaining;
            this.showCompSetModal = true;      // 다음 컴셋 모달 이어서 표시
        } else {
            this.showCompSetModal = false;     // 더 이상 모달 없음
            this.addToCart();                  // partsToCart 기반으로 실제 장바구니 반영
        }
    }

    addToCart() {
        // TODO: this.partsToCart 를 기준으로 장바구니 반영
        console.log('addToCart()', this.partsToCart);
    }

    // handleCompSetModalClose() {
    //     this.showCompSetModal = false;
    // }

    handleClickPrint(event) {
        console.log('handleClickPrint(event');
        // 인쇄 전용 레이아웃 팝업 또는 window.print()
    }
    
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant || 'info'
            })
        );
    }
}